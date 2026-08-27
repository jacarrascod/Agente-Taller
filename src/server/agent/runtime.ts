// Bucle de tool-calling del agente (SPEC.md §9.5). AgentRuntime:
//   1. Guardrail de entrada — si dispara, responde con plantilla SIN LLM.
//   2. Inyecta el bloque de contexto dinámico (fecha/hora actual).
//   3. Llama al LLM con las 9 tools, en modo native | json | auto.
//   4. Ejecuta tool_calls, persiste, reinyecta resultados, repite.
//   5. Streamea la respuesta final por SSE.
//   6. Guardrail de salida — descarta precios/horas sin tool que los respalde.

import "server-only";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import { clienteLLM, MAX_ITERACIONES_TOOLS, MODELO_LLM, TEMPERATURA_LLM } from "./llm";
import { NOMBRES_TOOLS, TOOLS_JSON_SCHEMA, ejecutarTool } from "./tools";
import {
  evaluarGuardrailEntrada,
  respuestaEsEcoDelTurnoAnterior,
  respuestaParcialTieneDatoSinRespaldo,
  respuestaTieneDatoSinRespaldo,
} from "./guardrails";
import { plantillasRechazo, systemPrompt } from "./prompt";
import { bloqueContextoFechaActual } from "../lib/fechas";
import { guardarMensaje, obtenerHistorialReciente, obtenerOCrearConversacion } from "./persistencia";

export type EventoAgente =
  | { tipo: "token"; texto: string }
  | { tipo: "tool_start"; nombre: string; etiqueta: string }
  | { tipo: "tool_end"; nombre: string; resultado: unknown; esError: boolean }
  | { tipo: "done"; textoFinal: string }
  | { tipo: "error"; mensaje: string };

export interface EntradaTurno {
  sessionId: string;
  mensajeNuevo: string;
}

type ModoTools = "native" | "json";

// DEF-10: `modoAutoCache` cachea a propósito por proceso (SPEC.md §9.5:
// "cachea la decisión por proceso") — es un hecho estable sobre el
// modelo/endpoint, correcto de compartir entre conversaciones. Pero
// `intentosNativoIgnorado` vivía también a nivel de módulo, así que dos
// turnos "ignorados" en dos conversaciones de clientes DISTINTOS y sin
// relación entre sí bastaban para conmutar TODO el proceso a modo json
// de forma permanente — no son "dos veces seguidas" del mismo hilo, que
// es lo que el SPEC pide detectar. Se mueve a variable local de
// `ejecutarTurno`, reiniciada en cada turno.
let modoAutoCache: ModoTools | null = null;

function modoConfigurado(): "auto" | "native" | "json" {
  const valor = (process.env.AGENT_TOOL_MODE ?? "auto").toLowerCase();
  if (valor === "native" || valor === "json") return valor;
  return "auto";
}

function modoActivo(): ModoTools {
  const configurado = modoConfigurado();
  if (configurado !== "auto") return configurado;
  return modoAutoCache ?? "native";
}

// SPEC.md §13.5: "Sin emojis: el mismo tratamiento de dato técnico que el
// resto del sistema" (DEF-12).
export const ETIQUETAS_TOOL_START: Record<string, string> = {
  buscar_repuestos: "Consultando inventario…",
  consultar_disponibilidad_repuesto: "Consultando inventario…",
  listar_mantenimientos: "Consultando mantenimientos…",
  consultar_disponibilidad_agenda: "Revisando la agenda…",
  agendar_cita: "Registrando la cita…",
  buscar_conocimiento: "Buscando en la guía Toyota…",
  agregar_al_carrito: "Actualizando el carrito…",
  consultar_citas: "Buscando sus citas…",
  cancelar_cita: "Cancelando la cita…",
};

function etiquetaTool(nombre: string): string {
  return ETIQUETAS_TOOL_START[nombre] ?? "Consultando…";
}

/**
 * El texto final se acumula por completo ANTES de enviarse (no se
 * reenvían los deltas crudos del LLM) para que el guardrail de salida
 * (capa 3) pueda descartarlo y sustituirlo si cita un precio/hora sin
 * respaldo — algo imposible de deshacer si ya se transmitió token a
 * token. Una vez validado, se trocea en fragmentos cortos para que el
 * cliente lo siga mostrando de forma incremental.
 */
function* dividirEnTrozos(texto: string): Generator<string> {
  const palabras = texto.split(/(\s+)/);
  const TAMANO_TROZO = 3;
  for (let i = 0; i < palabras.length; i += TAMANO_TROZO * 2) {
    yield palabras.slice(i, i + TAMANO_TROZO * 2).join("");
  }
}

function catalogoToolsParaPromptJson(): string {
  const lineas = TOOLS_JSON_SCHEMA.map((t) => {
    const params = JSON.stringify(t.function.parameters);
    return `- ${t.function.name}: ${t.function.description}\n  Parámetros JSON Schema: ${params}`;
  });
  return (
    `\n\n# MODO DE HERRAMIENTAS SIN FUNCTION-CALLING NATIVO\n` +
    `Este modelo no recibe las herramientas como "tools" de la API. Dispones de las mismas ` +
    `${TOOLS_JSON_SCHEMA.length} herramientas descritas abajo. Cuando necesites datos reales, responde ` +
    `EXCLUSIVAMENTE con un objeto JSON de una sola línea, sin texto adicional ni bloques de código: ` +
    `{"tool":"nombre_de_la_herramienta","args":{...}}\n` +
    `Si no necesitas ninguna herramienta, responde normalmente en texto para el cliente.\n\n` +
    `Herramientas disponibles:\n${lineas.join("\n")}`
  );
}

function intentoParseoJsonTool(texto: string): { nombre: string; args: unknown } | null {
  const limpio = texto.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  if (!limpio.startsWith("{")) return null;
  try {
    const obj = JSON.parse(limpio);
    if (obj && typeof obj.tool === "string" && NOMBRES_TOOLS.includes(obj.tool)) {
      return { nombre: obj.tool, args: obj.args ?? {} };
    }
  } catch {
    /* no era JSON de tool; se trata como texto final */
  }
  return null;
}

function pareceIntentoDeToolIgnorado(texto: string): boolean {
  return /"tool"\s*:/.test(texto) || /\bagendar_cita\b|\bbuscar_repuestos\b/.test(texto);
}

export async function* ejecutarTurno(entrada: EntradaTurno): AsyncGenerator<EventoAgente> {
  let conversacionId: string | null = null;
  let historial: { rol: "user" | "assistant"; contenido: string }[] = [];
  try {
    conversacionId = await obtenerOCrearConversacion(entrada.sessionId);
    historial = await obtenerHistorialReciente(conversacionId, 20);
  } catch (error) {
    console.error("No se pudo abrir la conversación:", error);
  }

  // La traza es obligatoria (SPEC.md §6.2/§15), pero no es prerrequisito de
  // nada de lo que sigue: se lanza aquí y se espera al final del turno, para
  // que el round-trip a Supabase se solape con la llamada al LLM en vez de
  // sumarse a ella. `guardarMensaje` ya captura sus propios errores.
  const escriturasEnVuelo: Promise<void>[] = [];
  if (conversacionId) {
    escriturasEnVuelo.push(
      guardarMensaje(conversacionId, { rol: "user", contenido: entrada.mensajeNuevo }),
    );
  }

  // ── Capa 1: guardrail determinista, antes del LLM ──────────────────
  const guardrailEntrada = evaluarGuardrailEntrada(entrada.mensajeNuevo);
  if (guardrailEntrada.bloquear) {
    const texto = plantillasRechazo.otraMarca(guardrailEntrada.marcaDetectada ?? "");
    if (conversacionId) {
      escriturasEnVuelo.push(guardarMensaje(conversacionId, { rol: "assistant", contenido: texto }));
    }
    yield { tipo: "token", texto };
    yield { tipo: "done", textoFinal: texto };
    await Promise.all(escriturasEnVuelo);
    return;
  }

  const mensajes: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt() + `\n\n${bloqueContextoFechaActual()}` },
  ];
  if (guardrailEntrada.recordatorioContexto) {
    mensajes.push({ role: "system", content: guardrailEntrada.recordatorioContexto });
  }
  for (const turno of historial) {
    mensajes.push({ role: turno.rol, content: turno.contenido });
  }
  if (modoActivo() === "json") {
    mensajes[0] = { role: "system", content: (mensajes[0].content as string) + catalogoToolsParaPromptJson() };
  }
  mensajes.push({ role: "user", content: entrada.mensajeNuevo });

  const toolsEjecutadasEnTurno: string[] = [];
  let intentosNativoIgnorado = 0; // DEF-10: por turno, no por proceso
  let intentosGuardrailSalida = 0;
  const cliente = clienteLLM();

  try {
    for (let iteracion = 0; iteracion < MAX_ITERACIONES_TOOLS; iteracion++) {
      const modo = modoActivo();
      const usaToolsNativas = modo === "native";

      let contenidoAcumulado = "";
      const toolCallsAcumuladas: { id: string; nombre: string; argsTexto: string }[] = [];
      let huboErrorTools400 = false;
      // Corte anticipado (SPEC.md §9.5): se corta la generación apenas el
      // guardrail de salida es inequívocamente violado, en vez de esperar
      // el párrafo completo que igual se va a descartar. No confundir con
      // las "capas" 1-3 de guardrails de §9.6: esto no es una capa nueva,
      // es la misma capa 3 evaluada antes.
      let cortadoAnticipadamente = false;
      const inicioLlamadaLlm = Date.now();

      try {
        const stream = await cliente.chat.completions.create({
          model: MODELO_LLM,
          messages: mensajes,
          temperature: TEMPERATURA_LLM,
          stream: true,
          ...(usaToolsNativas ? { tools: TOOLS_JSON_SCHEMA, tool_choice: "auto" as const } : {}),
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            contenidoAcumulado += delta.content;
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsAcumuladas[idx]) {
                toolCallsAcumuladas[idx] = { id: tc.id ?? `call_${idx}`, nombre: "", argsTexto: "" };
              }
              if (tc.function?.name) toolCallsAcumuladas[idx].nombre += tc.function.name;
              if (tc.function?.arguments) toolCallsAcumuladas[idx].argsTexto += tc.function.arguments;
            }
          }

          // Solo en modo nativo: en modo json el tool call viaja como texto
          // JSON dentro de `content`, y un `inicio_iso` a medio construir
          // contiene literalmente "09:00" — sería un falso corte seguro.
          // La condición se reevalúa en cada chunk: si el modelo revela un
          // tool call durante el margen de gracia, el corte se cancela.
          if (
            usaToolsNativas &&
            toolCallsAcumuladas.filter(Boolean).length === 0 &&
            respuestaParcialTieneDatoSinRespaldo(contenidoAcumulado, toolsEjecutadasEnTurno)
          ) {
            cortadoAnticipadamente = true;
            break;
          }
        }
        // El `break` de arriba basta para liberar la conexión: el iterador
        // del SDK aborta la petición en curso en su `finally` (openai
        // streaming.js "If the user `break`s, abort the ongoing request").
        // No hace falta un `stream.controller.abort()` explícito, y llamarlo
        // dentro del `for await` sería contraproducente.
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (usaToolsNativas && (status === 400 || status === 422) && modoConfigurado() === "auto") {
          huboErrorTools400 = true;
        } else {
          throw error;
        }
      }

      // Sin esta medida no hay forma de comparar la latencia antes/después
      // de las tres capas; la ejecución de tools ya se mide aparte
      // (`latencia_ms`), pero la llamada al LLM no se medía en ningún lado.
      console.info("Llamada al LLM completada.", {
        sessionId: entrada.sessionId,
        iteracion,
        modo,
        duracionMs: Date.now() - inicioLlamadaLlm,
        cortadoAnticipadamente,
        toolsEjecutadasEnTurno,
      });

      if (huboErrorTools400) {
        modoAutoCache = "json";
        mensajes[0] = {
          role: "system",
          content: systemPrompt() + `\n\n${bloqueContextoFechaActual()}` + catalogoToolsParaPromptJson(),
        };
        continue; // reintenta esta misma iteración en modo json
      }

      const hayToolCallsNativas = toolCallsAcumuladas.filter(Boolean).length > 0;

      // Modo json: el "tool call" viene como texto JSON en el contenido.
      if (!usaToolsNativas || (!hayToolCallsNativas && modoConfigurado() === "auto")) {
        const intento = intentoParseoJsonTool(contenidoAcumulado);
        if (intento) {
          if (modoConfigurado() === "auto" && usaToolsNativas) {
            // El modelo ignoró las tools nativas y respondió en texto plano.
            intentosNativoIgnorado += 1;
            if (intentosNativoIgnorado >= 2) modoAutoCache = "json";
          }
          yield { tipo: "tool_start", nombre: intento.nombre, etiqueta: etiquetaTool(intento.nombre) };
          const inicio = Date.now();
          const { resultado, esError } = await ejecutarTool(intento.nombre, intento.args);
          const latencia = Date.now() - inicio;
          toolsEjecutadasEnTurno.push(intento.nombre);
          if (conversacionId) {
            await guardarMensaje(conversacionId, {
              rol: "tool",
              toolNombre: intento.nombre,
              toolPayload: intento.args,
              toolResultado: resultado,
              latenciaMs: latencia,
            });
          }
          yield { tipo: "tool_end", nombre: intento.nombre, resultado, esError };
          mensajes.push({ role: "assistant", content: contenidoAcumulado });
          mensajes.push({
            role: "user",
            content: `Resultado de ${intento.nombre}: ${JSON.stringify(resultado)}`,
          });
          continue;
        }
        if (usaToolsNativas && modoConfigurado() === "auto" && pareceIntentoDeToolIgnorado(contenidoAcumulado)) {
          intentosNativoIgnorado += 1;
          if (intentosNativoIgnorado >= 2) modoAutoCache = "json";
        }
      }

      if (hayToolCallsNativas) {
        const llamadas = toolCallsAcumuladas.filter(Boolean);
        mensajes.push({
          role: "assistant",
          content: contenidoAcumulado || null,
          tool_calls: llamadas.map(
            (l): ChatCompletionMessageToolCall => ({
              id: l.id,
              type: "function",
              function: { name: l.nombre, arguments: l.argsTexto },
            }),
          ),
        });

        const ejecuciones = await Promise.all(
          llamadas.map(async (llamada) => {
            let args: unknown = {};
            try {
              args = llamada.argsTexto ? JSON.parse(llamada.argsTexto) : {};
            } catch {
              /* args inválidos → se envían vacíos, el schema Zod los rechazará con detalle */
            }
            const inicio = Date.now();
            const resultadoTool = await ejecutarTool(llamada.nombre, args);
            const latencia = Date.now() - inicio;
            return { llamada, args, resultadoTool, latencia };
          }),
        );

        for (const { llamada, args, resultadoTool, latencia } of ejecuciones) {
          toolsEjecutadasEnTurno.push(llamada.nombre);
          if (conversacionId) {
            await guardarMensaje(conversacionId, {
              rol: "tool",
              toolNombre: llamada.nombre,
              toolPayload: args,
              toolResultado: resultadoTool.resultado,
              latenciaMs: latencia,
            });
          }
        }

        for (const { llamada } of ejecuciones) {
          yield { tipo: "tool_start", nombre: llamada.nombre, etiqueta: etiquetaTool(llamada.nombre) };
        }
        for (const { llamada, resultadoTool } of ejecuciones) {
          yield { tipo: "tool_end", nombre: llamada.nombre, resultado: resultadoTool.resultado, esError: resultadoTool.esError };
          mensajes.push({
            role: "tool",
            tool_call_id: llamada.id,
            content: JSON.stringify(resultadoTool.resultado),
          });
        }
        continue;
      }

      // Sin tool calls: esta es la respuesta final.
      let textoFinal = contenidoAcumulado.trim();

      // ── Capa 3: guardrail de salida ──────────────────────────────────
      // El respaldo se exige del TURNO ACTUAL únicamente. Antes se aceptaba
      // cualquier tool ya ejecutada en el resto de la conversación (pensado
      // para recapitulaciones sin re-llamar la tool, R5) — pero eso permitía
      // que una tool llamada para un producto/servicio distinto, minutos u
      // horas antes, "respaldara" un precio u hora completamente ajenos.
      // Confirmado en navegación real: preguntar por el precio del Express 5K
      // recibió "S/ 199.00" (real: S/ 189.00) sin ninguna tool en ese turno,
      // solo porque antes en la misma conversación se había consultado un
      // repuesto distinto. Exigir el respaldo del propio turno cierra el
      // hueco; si es una recapitulación legítima, el reintento de abajo le
      // pide al modelo volver a llamar la tool (barato y siempre exacto).
      const sinRespaldo = respuestaTieneDatoSinRespaldo(textoFinal, toolsEjecutadasEnTurno);
      // DEF-24: el modelo a veces repite carácter por carácter su respuesta
      // del turno anterior en vez de atender el mensaje nuevo (visto en
      // navegación real contra el LLM real, no reproducible al 100 %).
      const esEco = !sinRespaldo && respuestaEsEcoDelTurnoAnterior(textoFinal, historial, entrada.mensajeNuevo);
      if (sinRespaldo || esEco) {
        console.warn(
          esEco
            ? "Guardrail de salida activado: la respuesta repite el turno anterior sin atender el mensaje nuevo (DEF-24)."
            : "Guardrail de salida activado: precio/hora sin tool de respaldo en este turno.",
          {
            sessionId: entrada.sessionId,
            toolsEjecutadasEnTurno,
            textoDescartado: textoFinal,
            reintento: intentosGuardrailSalida,
            cortadoAnticipadamente,
          },
        );
        // Antes de rendirse: se le da al modelo una oportunidad de
        // corregirse (llamando a la tool correcta, o atendiendo el mensaje
        // nuevo) antes de caer al mensaje de fallo.
        if (intentosGuardrailSalida < 1) {
          intentosGuardrailSalida += 1;
          mensajes.push({ role: "assistant", content: textoFinal });
          mensajes.push({
            role: "system",
            content: esEco
              ? `Tu respuesta anterior repitió, sin ningún cambio, lo que ya le habías dicho al cliente en el turno ` +
                `previo. El cliente acaba de escribir un mensaje nuevo y distinto: "${entrada.mensajeNuevo}". ` +
                `Respóndele específicamente a ese mensaje nuevo — no repitas la respuesta anterior.`
              : "Tu respuesta anterior mencionó un precio o una hora de cita sin haber llamado en este turno a la " +
                "herramienta que lo respalda. No repitas ese dato de memoria: si es un precio, llama a " +
                "buscar_repuestos o listar_mantenimientos; si es una hora de cita disponible, llama a " +
                "consultar_disponibilidad_agenda. Si aún no tienes la fecha exacta que pide el cliente, pregúntasela " +
                "en vez de sugerir una hora.",
          });
          continue;
        }
        textoFinal = plantillasRechazo.falloDeTool();
      }

      // `dividirEnTrozos` trocea texto ya completo de forma síncrona, así
      // que esperar aquí a Supabase se sumaba íntegro al tiempo hasta el
      // primer token visible. Se lanza ahora y se espera tras el `done`.
      if (conversacionId) {
        escriturasEnVuelo.push(
          guardarMensaje(conversacionId, { rol: "assistant", contenido: textoFinal }),
        );
      }

      for (const trozo of dividirEnTrozos(textoFinal)) {
        yield { tipo: "token", texto: trozo };
      }
      yield { tipo: "done", textoFinal };
      await Promise.all(escriturasEnVuelo);
      return;
    }

    // Se agotaron las iteraciones sin una respuesta final.
    console.warn("Se agotaron las iteraciones de tools sin respuesta final del modelo.", {
      sessionId: entrada.sessionId,
      maxIteraciones: MAX_ITERACIONES_TOOLS,
      toolsEjecutadasEnTurno,
    });
    const textoFinal = plantillasRechazo.falloDeTool();
    if (conversacionId) {
      escriturasEnVuelo.push(
        guardarMensaje(conversacionId, { rol: "assistant", contenido: textoFinal }),
      );
    }
    for (const trozo of dividirEnTrozos(textoFinal)) {
      yield { tipo: "token", texto: trozo };
    }
    yield { tipo: "done", textoFinal };
    await Promise.all(escriturasEnVuelo);
  } catch (error) {
    console.error("Error en AgentRuntime:", error);
    // Sin esto, un fallo del turno dejaría la traza a medio escribir como
    // promesa huérfana que el runtime puede cancelar al cerrar la respuesta.
    await Promise.all(escriturasEnVuelo).catch(() => {});
    yield { tipo: "error", mensaje: "El asistente no está disponible en este momento. Intente de nuevo en unos minutos." };
  }
}
