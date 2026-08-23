// Base de conocimiento Toyota (F3, SPEC.md §9.4 T6).

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";
import { ErrorAplicacion } from "../lib/errores";
import type { FaqToyota } from "@/types/dominio";

export async function buscarConocimiento(consulta: string): Promise<FaqToyota[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("buscar_conocimiento", { p_consulta: consulta, p_limite: 4 });
  if (error) {
    throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al buscar en la base de conocimiento: ${error.message}`, 500);
  }
  return (data ?? []).map((f) => ({
    id: f.id,
    pregunta: f.pregunta,
    respuesta: f.respuesta,
    categoria: f.categoria,
    relevancia: f.relevancia,
  }));
}
