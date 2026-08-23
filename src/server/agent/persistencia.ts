// Traza del agente (SPEC.md §6.2, §15 "Observabilidad"): cada mensaje y
// cada llamada a tool se persiste para poder auditar la conversación.

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";

export async function obtenerOCrearConversacion(sessionId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: existente } = await db
    .from("conversaciones")
    .select("id")
    .eq("session_id", sessionId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return existente.id;

  const { data: creada, error } = await db
    .from("conversaciones")
    .insert({ session_id: sessionId })
    .select("id")
    .single();
  if (error || !creada) {
    throw new Error(`No se pudo crear la conversación: ${error?.message ?? "desconocido"}`);
  }
  return creada.id;
}

export interface TurnoPersistido {
  rol: "user" | "assistant";
  contenido: string;
}

/** Últimos turnos user/assistant de la conversación (excluye tool/system). */
export async function obtenerHistorialReciente(conversacionId: string, limite = 20): Promise<TurnoPersistido[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("mensajes")
    .select("rol, contenido, creado_en")
    .eq("conversacion_id", conversacionId)
    .in("rol", ["user", "assistant"])
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("No se pudo leer el historial de la conversación:", error);
    return [];
  }
  return (data ?? [])
    .filter((m) => m.contenido)
    .reverse()
    .map((m) => ({ rol: m.rol as "user" | "assistant", contenido: m.contenido as string }));
}

export interface DatosMensaje {
  rol: "user" | "assistant" | "tool" | "system";
  contenido?: string | null;
  toolNombre?: string | null;
  toolPayload?: unknown;
  toolResultado?: unknown;
  latenciaMs?: number;
}

export async function guardarMensaje(conversacionId: string, mensaje: DatosMensaje): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("mensajes").insert({
    conversacion_id: conversacionId,
    rol: mensaje.rol,
    contenido: mensaje.contenido ?? null,
    tool_nombre: mensaje.toolNombre ?? null,
    tool_payload: (mensaje.toolPayload ?? null) as Record<string, unknown> | null,
    tool_resultado: (mensaje.toolResultado ?? null) as Record<string, unknown> | null,
    latencia_ms: mensaje.latenciaMs ?? null,
  });
  if (error) console.error("No se pudo guardar el mensaje en la traza del agente:", error);
}
