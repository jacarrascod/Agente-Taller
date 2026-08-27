#!/usr/bin/env tsx
// Variante SIN STREAMING de probar-continuidad-groq.ts. La prueba anterior
// (stream: true, igual que runtime.ts) dio ~19-21% de "Connection error"
// repartido de forma uniforme en toda la sesión (descartado el cold-start).
// Las llamadas fallidas se cortaban a medio camino (entre 1.9 s y 15.2 s),
// consistente con una conexión de streaming que se cae en pleno envío.
//
// Como runtime.ts YA acumula el texto completo antes de usarlo (el guardrail
// de salida necesita el texto entero para decidir si lo descarta — ver
// runtime.ts líneas 81-88), la app no necesita streaming real de la API del
// LLM. Esta variante pide stream: false (una sola respuesta HTTP normal, sin
// conexión de larga duración) con el mismo modelo, mismas 42 llamadas, mismo
// cliente reutilizado, para ver si el fallo desaparece o se mantiene.
//
// Uso: npx tsx scripts/probar-continuidad-groq-sinstream.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODELO = "openai/gpt-oss-120b";
const REPETICIONES = 3; // 14 casos x 3 = 42 llamadas en una sola sesión de cliente

function cargarEnvLocal(): void {
  const envPath = path.resolve(__dirname, "../.env.local");
  let contenido: string;
  try {
    contenido = readFileSync(envPath, "utf-8");
  } catch {
    console.error(`No se encontró ${envPath}. Configura .env.local antes de correr esta prueba.`);
    process.exit(1);
  }
  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const idx = limpia.indexOf("=");
    if (idx === -1) continue;
    const clave = limpia.slice(0, idx).trim();
    let valor = limpia.slice(idx + 1);
    const idxComentario = valor.indexOf(" #");
    if (idxComentario !== -1) valor = valor.slice(0, idxComentario);
    valor = valor.trim().replace(/^["']|["']$/g, "");
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

// Misma copia literal de TOOLS_JSON_SCHEMA que los scripts anteriores.
const TOOLS_JSON_SCHEMA: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_repuestos",
      description:
        "Busca repuestos en el catálogo por descripción libre, modelo y año. Úsala cuando el cliente menciona una pieza. Devuelve precio y stock reales.",
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string", description: "Qué busca el cliente, en sus palabras. Ej: 'pastillas de freno delanteras'" },
          modelo: { type: "string", description: "Modelo Toyota: Corolla, Yaris, Hilux, RAV4, Fortuner, Prius, Camry, Land Cruiser, Rush, Avanza" },
          anio: { type: "integer", minimum: 1990, maximum: 2027 },
          categoria: {
            type: "string",
            enum: ["filtros", "frenos", "motor", "suspension", "electrico", "lubricantes", "transmision", "accesorios"],
          },
          limite: { type: "integer", default: 5, maximum: 10 },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad_repuesto",
      description: "Consulta stock y precio exactos de un SKU concreto ya identificado.",
      parameters: { type: "object", properties: { sku: { type: "string" } }, required: ["sku"] },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_mantenimientos",
      description: "Devuelve los 3 servicios del taller con precio, duración e ítems incluidos. Sin parámetros.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad_agenda",
      description: "Devuelve los horarios libres. Úsala ANTES de ofrecer cualquier hora.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD (hora de Lima)" },
          fecha_hasta: { type: "string", description: "Opcional. Para consultar un rango de hasta 7 días." },
        },
        required: ["fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_cita",
      description: "Registra la cita. Solo tras confirmación explícita del cliente (R5).",
      parameters: {
        type: "object",
        properties: {
          inicio_iso: { type: "string", description: "Inicio en ISO 8601 con offset de Lima, tomado tal cual de consultar_disponibilidad_agenda" },
          mantenimiento_slug: { type: "string", enum: ["express-5k", "preventivo-20k", "mayor-40k"] },
          nombre_cliente: { type: "string" },
          email: { type: "string" },
          telefono: { type: "string" },
          modelo_vehiculo: { type: "string" },
          anio_vehiculo: { type: "integer" },
          placa: { type: "string" },
          notas: { type: "string" },
        },
        required: ["inicio_iso", "mantenimiento_slug", "nombre_cliente", "email", "telefono", "modelo_vehiculo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_conocimiento",
      description: "Base de conocimiento sobre repuestos y mantenimiento Toyota. Úsala para toda pregunta técnica antes de responder.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string" }, modelo: { type: "string" } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description:
        "Agrega un repuesto al carrito de compra del cliente. Llama a esta tool SIEMPRE que el cliente confirme que quiere agregar, comprar o llevar un repuesto que ya identificaste (ej. dice 'sí', 'agrégalo', 'lo quiero', 'échalo al carrito'). No lo des por hecho ni lo digas sin haber llamado a esta tool: el carrito solo cambia cuando la ejecutas.",
      parameters: {
        type: "object",
        properties: { sku: { type: "string" }, cantidad: { type: "integer", default: 1 } },
        required: ["sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_citas",
      description:
        "Busca las citas de un cliente usando su correo electrónico. Úsala cuando el cliente pregunte si tiene una cita, cuándo es, o quiera cancelarla. El correo debe haberlo escrito él; nunca lo inventes.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Correo tal como lo escribió el cliente" },
          incluir_pasadas: { type: "boolean", default: false, description: "true si el cliente pregunta por su historial" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_cita",
      description: "Cancela una cita confirmada. Libera el horario y borra el evento del calendario. Solo tras doble confirmación explícita (R8).",
      parameters: {
        type: "object",
        properties: {
          codigo: { type: "string", description: "Código exacto devuelto por consultar_citas, ej. CITA-2026-0007" },
          email: { type: "string", description: "El mismo correo con el que se encontró la cita" },
          motivo: { type: "string", description: "Opcional, si el cliente lo menciona" },
        },
        required: ["codigo", "email"],
      },
    },
  },
];

const CASOS: { id: string; mensaje: string }[] = [
  { id: "SIN-01", mensaje: "Hola" },
  { id: "SIN-01b", mensaje: "Hola" },
  { id: "SIN-01c", mensaje: "Hola" },
  { id: "SIN-02", mensaje: "¿Cuál es la dirección del taller?" },
  { id: "SIN-03", mensaje: "¿Atienden los sábados?" },
  { id: "SIN-04", mensaje: "¿Eres una persona real o un bot?" },
  { id: "TOOL-01", mensaje: "¿Cuánto cuesta el filtro de aceite para un Corolla 2018?" },
  { id: "TOOL-02", mensaje: "¿Qué mantenimientos ofrecen y cuánto cuestan?" },
  { id: "TOOL-02b", mensaje: "¿Qué mantenimientos ofrecen y cuánto cuestan?" },
  { id: "TOOL-03", mensaje: "¿Tienen disponibilidad el lunes 31 de agosto para un Express 5K?" },
  { id: "TOOL-04", mensaje: "¿Cuánto cuesta el kit de embrague en soles?" },
  { id: "TOOL-05", mensaje: "Mi correo es prueba.latencia@example.com, ¿tengo alguna cita agendada?" },
  {
    id: "LARGO-01",
    mensaje:
      "Buenas tardes, tengo un Toyota Corolla 2018 y hace unos días empezó a hacer un ruido raro cuando freno, " +
      "como un chirrido metálico, y además ya le toca el mantenimiento de rutina porque tiene como 21,000 km. " +
      "¿Podrían decirme cuánto costaría revisar los frenos y hacer el mantenimiento de una vez, y si tienen " +
      "disponibilidad esta semana?",
  },
  {
    id: "LARGO-02",
    mensaje:
      "Quiero agendar el Express 5K para el lunes a las 10, mis datos son Juan Pérez, teléfono 987654321, " +
      "correo juan.perez.prueba@example.com, vehículo Corolla 2018 placa ABC123",
  },
];

interface Resultado {
  indice: number;
  vuelta: number;
  id: string;
  duracionMs: number;
  error: string | null;
}

async function main() {
  cargarEnvLocal();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Falta GROQ_API_KEY en .env.local");
    process.exit(1);
  }

  // UN SOLO cliente para toda la sesión, igual que clienteLLM() en producción
  // (se crea una vez por proceso, no una vez por turno).
  const cliente = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });

  const { systemPrompt } = await import("../src/server/agent/prompt");
  const { bloqueContextoFechaActual } = await import("../src/server/lib/fechas");
  const promptSistema = systemPrompt() + `\n\n${bloqueContextoFechaActual()}`;

  const totalLlamadas = CASOS.length * REPETICIONES;
  console.log(`Modelo: ${MODELO} | ${totalLlamadas} llamadas en UNA sola sesión de cliente (${REPETICIONES} vueltas x ${CASOS.length} casos)\n`);

  const resultados: Resultado[] = [];
  let indiceGlobal = 0;

  for (let vuelta = 1; vuelta <= REPETICIONES; vuelta++) {
    for (const caso of CASOS) {
      indiceGlobal++;
      const mensajes: ChatCompletionMessageParam[] = [
        { role: "system", content: promptSistema },
        { role: "user", content: caso.mensaje },
      ];

      process.stdout.write(`[#${String(indiceGlobal).padStart(2, "0")} v${vuelta} ${caso.id}] ... `);
      const inicio = Date.now();
      let error: string | null = null;

      try {
        await cliente.chat.completions.create({
          model: MODELO,
          messages: mensajes,
          temperature: Number(process.env.AGENT_TEMPERATURE ?? 0.3),
          stream: false,
          tools: TOOLS_JSON_SCHEMA,
          tool_choice: "auto",
        });
        // Sin streaming: si create() resuelve sin lanzar, la respuesta llegó completa.
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const duracionMs = Date.now() - inicio;
      resultados.push({ indice: indiceGlobal, vuelta, id: caso.id, duracionMs, error });
      console.log(error ? `ERROR: ${error}` : `${duracionMs} ms`);

      await new Promise((res) => setTimeout(res, 2500));
    }
  }

  const fallos = resultados.filter((r) => r.error);
  console.log("\n================ ANÁLISIS DE CLUSTERING ================");
  console.log(`Total llamadas: ${resultados.length} | Fallos: ${fallos.length} (${((fallos.length / resultados.length) * 100).toFixed(1)}%)`);
  console.log(`Índices que fallaron: ${fallos.map((f) => f.indice).join(", ") || "ninguno"}`);

  const primeraLlamadaFallo = resultados[0]?.error != null;
  console.log(`¿Falló la primera llamada de la sesión (#1)? ${primeraLlamadaFallo ? "SÍ" : "no"}`);

  console.log("\n-- Distribución por bloques de 7 --");
  for (let inicio = 1; inicio <= totalLlamadas; inicio += 7) {
    const fin = Math.min(inicio + 6, totalLlamadas);
    const bloque = resultados.filter((r) => r.indice >= inicio && r.indice <= fin);
    const fallosBloque = bloque.filter((r) => r.error).length;
    console.log(`  #${inicio}-#${fin}: ${fallosBloque}/${bloque.length} fallos`);
  }

  console.log("\n-- Primeras 3 llamadas de cada vuelta (¿se repite el patrón de 'cold start'?) --");
  for (let vuelta = 1; vuelta <= REPETICIONES; vuelta++) {
    const primeras = resultados.filter((r) => r.vuelta === vuelta).slice(0, 3);
    console.log(`  Vuelta ${vuelta}: ${primeras.map((r) => (r.error ? "FALLO" : "ok")).join(", ")}`);
  }

  console.log("\n================ DETALLE ================");
  for (const r of resultados) {
    console.log(`#${String(r.indice).padStart(2, "0")} v${r.vuelta} ${r.id.padEnd(10)} ${String(r.duracionMs).padStart(7)} ms${r.error ? `  ERROR: ${r.error}` : ""}`);
  }
}

main().catch((e) => {
  console.error("Fallo general del script:", e);
  process.exit(1);
});
