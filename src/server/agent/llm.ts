// Cliente OpenAI-compatible. Soporta tres proveedores intercambiables por
// variable de entorno (AGENT_LLM_PROVIDER=nvidia|groq|openai): NVIDIA NIM
// (SPEC.md §3, §5), Groq y OpenAI. Los tres exponen (o son) una API
// compatible con el SDK de OpenAI, así que el resto del código (runtime.ts)
// no necesita saber cuál está activo.
//
// Ver INFORME-LATENCIA-CHAT.md: NVIDIA NIM promedia ~18-22s por llamada;
// Groq (gpt-oss-120b) promedia ~3-5s pero con ~15-20% de "Connection error"
// transitorios bajo carga — de ahí AGENT_LLM_MAX_RETRIES (ver runtime.ts) — y
// además tiene cupos de free tier bastante ajustados para este agente
// (8,000 tokens/min y 200,000 tokens/día para gpt-oss-120b: ver el 429 de
// tokens-por-día documentado en la investigación de esa fecha). OpenAI
// (gpt-5-mini, elegido por barato — $0.25/$2 por MTok — y confiable en
// tool-calling, sin los cupos gratuitos ajustados de Groq) es la tercera
// opción, de pago.

import "server-only";
import OpenAI from "openai";

type Proveedor = "nvidia" | "groq" | "openai";

interface ConfigProveedor {
  apiKeyEnv: string;
  baseURLEnv: string;
  baseURLPorDefecto: string;
  modeloEnv: string;
  modeloPorDefecto: string;
}

const CONFIG_PROVEEDORES: Record<Proveedor, ConfigProveedor> = {
  nvidia: {
    apiKeyEnv: "NVIDIA_API_KEY",
    baseURLEnv: "NVIDIA_BASE_URL",
    baseURLPorDefecto: "https://integrate.api.nvidia.com/v1",
    modeloEnv: "NVIDIA_MODEL",
    modeloPorDefecto: "meta/muse-glimmer-30b",
  },
  groq: {
    apiKeyEnv: "GROQ_API_KEY",
    baseURLEnv: "GROQ_BASE_URL",
    baseURLPorDefecto: "https://api.groq.com/openai/v1",
    modeloEnv: "GROQ_MODEL",
    modeloPorDefecto: "openai/gpt-oss-120b",
  },
  openai: {
    // Nombre de variable ya en uso en este proyecto (OPENAI_TOKEN, no
    // OPENAI_API_KEY) — se respeta para no romper el .env.local existente.
    apiKeyEnv: "OPENAI_TOKEN",
    baseURLEnv: "OPENAI_BASE_URL",
    baseURLPorDefecto: "https://api.openai.com/v1",
    modeloEnv: "OPENAI_MODEL",
    modeloPorDefecto: "gpt-5-mini",
  },
};

function proveedorConfigurado(): Proveedor {
  const valor = (process.env.AGENT_LLM_PROVIDER ?? "nvidia").toLowerCase();
  if (valor === "groq" || valor === "openai") return valor;
  if (valor !== "nvidia") {
    console.warn(`AGENT_LLM_PROVIDER="${valor}" no reconocido; usando "nvidia" por defecto.`);
  }
  return "nvidia";
}

const PROVEEDOR_ACTIVO = proveedorConfigurado();
const CONFIG_ACTIVA = CONFIG_PROVEEDORES[PROVEEDOR_ACTIVO];

let cliente: OpenAI | null = null;

export function clienteLLM(): OpenAI {
  if (cliente) return cliente;
  const apiKey = process.env[CONFIG_ACTIVA.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `Falta ${CONFIG_ACTIVA.apiKeyEnv} (requerido por AGENT_LLM_PROVIDER=${PROVEEDOR_ACTIVO}). ` +
        "Configura .env.local a partir de .env.example.",
    );
  }
  cliente = new OpenAI({
    apiKey,
    baseURL: process.env[CONFIG_ACTIVA.baseURLEnv] ?? CONFIG_ACTIVA.baseURLPorDefecto,
    // Cubre fallos de conexión y 429/5xx transitorios ANTES de que el SDK
    // nos los propague (con backoff y respeto de Retry-After incluidos).
    // Ver AGENT_LLM_MAX_RETRIES / esErrorReintentable en runtime.ts para la
    // segunda capa, que cubre un stream que se corta a medio camino (fuera
    // del alcance del reintento interno del SDK, que solo cubre la conexión
    // inicial).
    maxRetries: Number(process.env.AGENT_LLM_MAX_RETRIES ?? 2),
  });
  return cliente;
}

export const PROVEEDOR_LLM = PROVEEDOR_ACTIVO;
export const MODELO_LLM = process.env[CONFIG_ACTIVA.modeloEnv] ?? CONFIG_ACTIVA.modeloPorDefecto;
export const TEMPERATURA_LLM = Number(process.env.AGENT_TEMPERATURE ?? 0.3);
export const MAX_ITERACIONES_TOOLS = Number(process.env.AGENT_MAX_TOOL_ITERATIONS ?? 5);
export const REINTENTOS_LLM = Number(process.env.AGENT_LLM_MAX_RETRIES ?? 2);

// Los modelos de razonamiento de OpenAI (gpt-5* y la familia o1/o3/o4) NO
// aceptan `temperature` personalizado — la API responde 400
// "Unsupported value: 'temperature' does not support 0.3 with this model.
// Only the default (1) value is supported." Detectado en vivo al probar
// gpt-5-mini. Se detecta por el nombre del MODELO, no por el proveedor: si
// mañana OPENAI_MODEL apunta a gpt-4.1-mini (que sí soporta temperature),
// esto se ajusta solo.
export const SOPORTA_TEMPERATURA_PERSONALIZADA = !/^(gpt-5|o1|o3|o4)(\D|$)/.test(MODELO_LLM);

// Se registra una sola vez al arrancar el proceso: con dos proveedores
// intercambiables por env var, es fácil arrancar el servidor sin darse
// cuenta de cuál quedó activo. Nunca se loguea la API key.
console.info(
  `[llm] Proveedor activo: ${PROVEEDOR_LLM} | modelo: ${MODELO_LLM} | baseURL: ${
    process.env[CONFIG_ACTIVA.baseURLEnv] ?? CONFIG_ACTIVA.baseURLPorDefecto
  } | maxRetries: ${REINTENTOS_LLM}`,
);
