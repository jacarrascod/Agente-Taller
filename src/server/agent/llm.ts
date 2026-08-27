// Cliente OpenAI-compatible. Soporta dos proveedores intercambiables por
// variable de entorno (AGENT_LLM_PROVIDER=nvidia|groq): NVIDIA NIM (SPEC.md
// §3, §5) y Groq. Ambos exponen una API compatible con el SDK de OpenAI, así
// que el resto del código (runtime.ts) no necesita saber cuál está activo.
//
// Ver INFORME-LATENCIA-CHAT.md: NVIDIA NIM promedia ~18-22s por llamada;
// Groq (gpt-oss-120b) promedia ~3-5s pero con ~15-20% de "Connection error"
// transitorios bajo carga — de ahí AGENT_LLM_MAX_RETRIES (ver runtime.ts).

import "server-only";
import OpenAI from "openai";

type Proveedor = "nvidia" | "groq";

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
};

function proveedorConfigurado(): Proveedor {
  const valor = (process.env.AGENT_LLM_PROVIDER ?? "nvidia").toLowerCase();
  if (valor === "groq") return "groq";
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

// Se registra una sola vez al arrancar el proceso: con dos proveedores
// intercambiables por env var, es fácil arrancar el servidor sin darse
// cuenta de cuál quedó activo. Nunca se loguea la API key.
console.info(
  `[llm] Proveedor activo: ${PROVEEDOR_LLM} | modelo: ${MODELO_LLM} | baseURL: ${
    process.env[CONFIG_ACTIVA.baseURLEnv] ?? CONFIG_ACTIVA.baseURLPorDefecto
  } | maxRetries: ${REINTENTOS_LLM}`,
);
