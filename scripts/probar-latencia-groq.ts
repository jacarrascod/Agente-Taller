#!/usr/bin/env tsx
// Prueba de conexión DIRECTA a la API de Groq (free tier), con los mismos 14
// casos y el mismo system prompt / catálogo de tools que
// scripts/probar-latencia-nvidia.ts, para poder comparar en igualdad de
// condiciones contra los números ya medidos de NVIDIA NIM.
//
// Groq expone un endpoint compatible con OpenAI (https://api.groq.com/openai/v1),
// así que solo hace falta GROQ_API_KEY — el endpoint queda fijo en este script,
// no hace falta declarar GROQ_BASE_URL en .env.local.
//
// No ejecuta ninguna tool real: mide solo la respuesta cruda del LLM.
//
// Uso: npx tsx scripts/probar-latencia-groq.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Modelos gratuitos de Groq a comparar. El catálogo real de la cuenta se
// obtuvo con GET /v1/models — "llama-3.3-70b-versatile" y "kimi-k2" que
// aparecían en artículos de referencia YA NO están disponibles en esta
// cuenta/región. Candidatos reales para chat + tools: gpt-oss-120b (ya
// probado), gpt-oss-20b (más chico/rápido) y los Qwen3.
const MODELOS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

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

// Copia literal de TOOLS_JSON_SCHEMA (src/server/agent/tools.ts) — idéntica a
// la usada en probar-latencia-nvidia.ts, para que la comparación sea justa.
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

interface CasoPrueba {
  id: string;
  categoria: "sin_tool" | "con_tool" | "mensaje_largo";
  mensaje: string;
}

// Idénticos a los de probar-latencia-nvidia.ts — misma vara de medir.
const CASOS: CasoPrueba[] = [
  { id: "SIN-01", categoria: "sin_tool", mensaje: "Hola" },
  { id: "SIN-01b", categoria: "sin_tool", mensaje: "Hola" },
  { id: "SIN-01c", categoria: "sin_tool", mensaje: "Hola" },
  { id: "SIN-02", categoria: "sin_tool", mensaje: "¿Cuál es la dirección del taller?" },
  { id: "SIN-03", categoria: "sin_tool", mensaje: "¿Atienden los sábados?" },
  { id: "SIN-04", categoria: "sin_tool", mensaje: "¿Eres una persona real o un bot?" },
  { id: "TOOL-01", categoria: "con_tool", mensaje: "¿Cuánto cuesta el filtro de aceite para un Corolla 2018?" },
  { id: "TOOL-02", categoria: "con_tool", mensaje: "¿Qué mantenimientos ofrecen y cuánto cuestan?" },
  { id: "TOOL-02b", categoria: "con_tool", mensaje: "¿Qué mantenimientos ofrecen y cuánto cuestan?" },
  { id: "TOOL-03", categoria: "con_tool", mensaje: "¿Tienen disponibilidad el lunes 31 de agosto para un Express 5K?" },
  { id: "TOOL-04", categoria: "con_tool", mensaje: "¿Cuánto cuesta el kit de embrague en soles?" },
  { id: "TOOL-05", categoria: "con_tool", mensaje: "Mi correo es prueba.latencia@example.com, ¿tengo alguna cita agendada?" },
  {
    id: "LARGO-01",
    categoria: "mensaje_largo",
    mensaje:
      "Buenas tardes, tengo un Toyota Corolla 2018 y hace unos días empezó a hacer un ruido raro cuando freno, " +
      "como un chirrido metálico, y además ya le toca el mantenimiento de rutina porque tiene como 21,000 km. " +
      "¿Podrían decirme cuánto costaría revisar los frenos y hacer el mantenimiento de una vez, y si tienen " +
      "disponibilidad esta semana?",
  },
  {
    id: "LARGO-02",
    categoria: "mensaje_largo",
    mensaje:
      "Quiero agendar el Express 5K para el lunes a las 10, mis datos son Juan Pérez, teléfono 987654321, " +
      "correo juan.perez.prueba@example.com, vehículo Corolla 2018 placa ABC123",
  },
];

interface Resultado {
  modelo: string;
  id: string;
  categoria: string;
  mensaje: string;
  duracionMs: number;
  longitudSalida: number;
  huboToolCall: boolean;
  toolLlamada: string | null;
  finishReason: string | null;
  error: string | null;
}

function media(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function mediana(valores: number[]): number {
  const s = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function desviacionEstandar(valores: number[]): number {
  const m = media(valores);
  return Math.sqrt(media(valores.map((v) => (v - m) ** 2)));
}

async function main() {
  cargarEnvLocal();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Falta GROQ_API_KEY en .env.local");
    process.exit(1);
  }
  const cliente = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  const TEMPERATURA_LLM = Number(process.env.AGENT_TEMPERATURE ?? 0.3);

  const { systemPrompt } = await import("../src/server/agent/prompt");
  const { bloqueContextoFechaActual } = await import("../src/server/lib/fechas");

  const promptSistema = systemPrompt() + `\n\n${bloqueContextoFechaActual()}`;

  console.log(`Endpoint: ${GROQ_BASE_URL} | temperatura: ${TEMPERATURA_LLM}`);
  console.log(`Modelos: ${MODELOS.join(", ")}`);
  console.log(`${CASOS.length} casos por modelo, 1 llamada cada uno (sin historial, sin ejecutar tools)\n`);

  const resultados: Resultado[] = [];

  for (const modelo of MODELOS) {
    console.log(`\n========== ${modelo} ==========`);
    for (const caso of CASOS) {
      const mensajes: ChatCompletionMessageParam[] = [
        { role: "system", content: promptSistema },
        { role: "user", content: caso.mensaje },
      ];

      process.stdout.write(`[${caso.id}] "${caso.mensaje.slice(0, 55)}${caso.mensaje.length > 55 ? "…" : ""}" ... `);
      const inicio = Date.now();
      let contenido = "";
      const toolCalls: { nombre: string }[] = [];
      let finishReason: string | null = null;
      let error: string | null = null;

      try {
        const stream = await cliente.chat.completions.create({
          model: modelo,
          messages: mensajes,
          temperature: TEMPERATURA_LLM,
          stream: true,
          tools: TOOLS_JSON_SCHEMA,
          tool_choice: "auto",
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) contenido += delta.content;
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) toolCalls[idx] = { nombre: "" };
              if (tc.function?.name) toolCalls[idx].nombre += tc.function.name;
            }
          }
          if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const duracionMs = Date.now() - inicio;
      const toolsLlamadas = toolCalls.filter(Boolean);
      const r: Resultado = {
        modelo,
        id: caso.id,
        categoria: caso.categoria,
        mensaje: caso.mensaje,
        duracionMs,
        longitudSalida: contenido.length,
        huboToolCall: toolsLlamadas.length > 0,
        toolLlamada: toolsLlamadas[0]?.nombre ?? null,
        finishReason,
        error,
      };
      resultados.push(r);
      console.log(error ? `ERROR: ${error}` : `${duracionMs} ms${r.huboToolCall ? `  (tool: ${r.toolLlamada})` : "  (texto)"}`);

      // Groq free tier: 30 req/min. 3s de espaciado deja margen amplio.
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  console.log("\n================ RESUMEN GLOBAL (todos los modelos) ================");
  for (const modelo of MODELOS) {
    const deEsteModelo = resultados.filter((r) => r.modelo === modelo);
    const exitosos = deEsteModelo.filter((r) => !r.error);
    const duraciones = exitosos.map((r) => r.duracionMs);
    console.log(`\n-- ${modelo} --`);
    console.log(`Llamadas exitosas: ${exitosos.length}/${deEsteModelo.length}`);
    if (duraciones.length > 0) {
      console.log(`Promedio: ${media(duraciones).toFixed(0)} ms`);
      console.log(`Mediana:  ${mediana(duraciones).toFixed(0)} ms`);
      console.log(`Desv. estándar: ${desviacionEstandar(duraciones).toFixed(0)} ms`);
      console.log(`Mínimo:   ${Math.min(...duraciones)} ms`);
      console.log(`Máximo:   ${Math.max(...duraciones)} ms`);
    }
    for (const cat of ["sin_tool", "con_tool", "mensaje_largo"] as const) {
      const deLaCat = exitosos.filter((r) => r.categoria === cat).map((r) => r.duracionMs);
      if (deLaCat.length === 0) continue;
      console.log(
        `  ${cat.padEnd(14)} n=${deLaCat.length}  promedio=${media(deLaCat).toFixed(0)} ms  mín=${Math.min(...deLaCat)} ms  máx=${Math.max(...deLaCat)} ms`,
      );
    }
  }

  console.log("\n================ DETALLE POR CASO ================");
  for (const r of resultados) {
    console.log(
      `${r.modelo.padEnd(26)} ${r.id.padEnd(10)} ${r.categoria.padEnd(14)} ${String(r.duracionMs).padStart(7)} ms  ${r.huboToolCall ? `tool=${r.toolLlamada}` : "sin tool"}${r.error ? `  ERROR: ${r.error}` : ""}`,
    );
  }

  console.log("\n================ JSON ================");
  console.log(JSON.stringify(resultados, null, 2));
}

main().catch((e) => {
  console.error("Fallo general del script:", e);
  process.exit(1);
});
