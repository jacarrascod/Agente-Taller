// Cliente OpenAI-compatible apuntando a NVIDIA NIM (SPEC.md §3, §5).

import "server-only";
import OpenAI from "openai";

let cliente: OpenAI | null = null;

export function clienteLLM(): OpenAI {
  if (cliente) return cliente;
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("Falta NVIDIA_API_KEY. Configura .env.local a partir de .env.example.");
  }
  cliente = new OpenAI({
    apiKey,
    baseURL: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  });
  return cliente;
}

export const MODELO_LLM = process.env.NVIDIA_MODEL ?? "meta/muse-glimmer-30b";
export const TEMPERATURA_LLM = Number(process.env.AGENT_TEMPERATURE ?? 0.3);
export const MAX_ITERACIONES_TOOLS = Number(process.env.AGENT_MAX_TOOL_ITERATIONS ?? 5);
