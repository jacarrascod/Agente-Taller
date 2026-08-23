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
import { evaluarGuardrailEntrada, respuestaTieneDatoSinRespaldo } from "./guardrails";
import { plantillasRechazo, systemPrompt } from "./prompt";
import { bloqueContextoFechaActual } from "../lib/fechas";
import {
  guardarMensaje,
  obtenerHistorialReciente,
  obtenerOCrearConversacion,
  obtenerToolsEjecutadasEnConversacion,
} from "./persistencia";

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
  let toolsEjecutadasPrevias: string[] = [];
  try {
    conversacionId = await obtenerOCrearConversacion(entrada.sessionId);
    [historial, toolsEjecutadasPrevias] = await Promise.all([
      obtenerHistorialReciente(conversacionId, 20),
      obtenerToolsEjecutadasEnConversacion(conversacionId),
    ]);
  } catch (error) {
    console.error("No se pudo abrir la conversación:", error);
  }

  if (conversacionId) {
    await guardarMensaje(conversacionId, { rol: "user", contenido: entrada.mensajeNuevo });
  }

  // ── Capa 1: guardrail determinista, antes del LLM ──────────────────
  const guardrailEntrada = evaluarGuardrailEntrada(entrada.mensajeNuevo);
  if (guardrailEntrada.bloquear) {
    const texto = plantillasRechazo.otraMarca(guardrailEntrada.marcaDetectada ?? "");
    if (conversacionId) await guardarMensaje(conversacionId, { rol: "assistant", contenido: texto });
    yield { tipo: "token", texto };
    yield { tipo: "done", textoFinal: texto };
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
        }
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (usaToolsNativas && (status === 400 || status === 422) && modoConfigurado() === "auto") {
          huboErrorTools400 = true;
        } else {
          throw error;
        }
      }

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
      const toolsQueRespaldan = [...toolsEjecutadasEnTurno, ...toolsEjecutadasPrevias];
      if (respuestaTieneDatoSinRespaldo(textoFinal, toolsQueRespaldan)) {
        console.warn("Guardrail de salida activado: precio/hora sin tool de respaldo en la conversación.", {
          sessionId: entrada.sessionId,
          toolsEjecutadasEnTurno,
          toolsEjecutadasPrevias,
          textoDescartado: textoFinal,
          reintento: intentosGuardrailSalida,
        });
        // Antes de rendirse: probablemente el modelo mencionó un dato de
        // memoria en vez de llamar a la tool (ej. una hora de ejemplo del
        // horario del taller). Se le da una oportunidad de corregirlo
        // llamando a la tool correcta antes de caer al mensaje de fallo.
        if (intentosGuardrailSalida < 1) {
          intentosGuardrailSalida += 1;
          mensajes.push({ role: "assistant", content: textoFinal });
          mensajes.push({
            role: "system",
            content:
              "Tu respuesta anterior mencionó un precio o una hora de cita sin haber llamado en este turno a la " +
              "herramienta que lo respalda. No repitas ese dato de memoria: si es un precio, llama a " +
              "buscar_repuestos o listar_mantenimientos; si es una hora de cita disponible, llama a " +
              "consultar_disponibilidad_agenda. Si aún no tienes la fecha exacta que pide el cliente, pregúntasela " +
              "en vez de sugerir una hora.",
          });
          continue;
        }
        textoFinal = plantillasRechazo.falloDeTool();
      }

      if (conversacionId) {
        await guardarMensaje(conversacionId, { rol: "assistant", contenido: textoFinal });
      }

      for (const trozo of dividirEnTrozos(textoFinal)) {
        yield { tipo: "token", texto: trozo };
      }
      yield { tipo: "done", textoFinal };
      return;
    }

    // Se agotaron las iteraciones sin una respuesta final.
    console.warn("Se agotaron las iteraciones de tools sin respuesta final del modelo.", {
      sessionId: entrada.sessionId,
      maxIteraciones: MAX_ITERACIONES_TOOLS,
      toolsEjecutadasEnTurno,
    });
    const textoFinal = plantillasRechazo.falloDeTool();
    if (conversacionId) await guardarMensaje(conversacionId, { rol: "assistant", contenido: textoFinal });
    for (const trozo of dividirEnTrozos(textoFinal)) {
      yield { tipo: "token", texto: trozo };
    }
    yield { tipo: "done", textoFinal };
  } catch (error) {
    console.error("Error en AgentRuntime:", error);
    yield { tipo: "error", mensaje: "El asistente no está disponible en este momento. Intente de nuevo en unos minutos." };
  }
}
