// Fachada de envío con idempotencia (SPEC.md §11.4).
// clave_idem = tipo + ':' + referencia. El índice único de emails_enviados
// impide enviar dos veces el mismo correo aunque se reintente la tool o el
// endpoint. El envío nunca bloquea la respuesta al cliente más de 3s
// (timeout ya aplicado dentro de integrations/brevo.ts).

import "server-only";
import { enviarCorreo, proveedorActivo, type DestinatarioCorreo } from "../integrations/brevo";
import { supabaseAdmin } from "../integrations/supabase";

export type TipoCorreo = "cita_confirmada" | "cita_cancelada" | "pedido_confirmado";

export interface SolicitudEnvio {
  tipo: TipoCorreo;
  referencia: string; // código de cita o de pedido
  destinatario: DestinatarioCorreo;
  asunto: string;
  htmlContent: string;
  textContent: string;
}

export interface ResultadoEnvio {
  enviado: boolean;
  yaEnviado: boolean;
  error?: string;
}

export async function enviarCorreoTransaccional(solicitud: SolicitudEnvio): Promise<ResultadoEnvio> {
  const claveIdem = `${solicitud.tipo}:${solicitud.referencia}`;
  const db = supabaseAdmin();

  const { data: previo } = await db
    .from("emails_enviados")
    .select("id")
    .eq("clave_idem", claveIdem)
    .eq("estado", "enviado")
    .maybeSingle();

  if (previo) {
    return { enviado: true, yaEnviado: true };
  }

  const resultado = await enviarCorreo({
    destinatario: solicitud.destinatario,
    asunto: solicitud.asunto,
    htmlContent: solicitud.htmlContent,
    textContent: solicitud.textContent,
  });

  const { error: errorInsert } = await db.from("emails_enviados").insert({
    tipo: solicitud.tipo,
    destinatario: solicitud.destinatario.email,
    asunto: solicitud.asunto,
    referencia: solicitud.referencia,
    clave_idem: claveIdem,
    proveedor: proveedorActivo(),
    proveedor_id: resultado.proveedorId ?? null,
    estado: resultado.ok ? "enviado" : "fallido",
    error_detalle: resultado.error ?? null,
  });

  if (errorInsert) {
    // Carrera: otro proceso ya registró el envío exitoso con esta clave_idem
    // (violación del índice único). Tratamos como éxito idempotente.
    if (errorInsert.code === "23505") {
      return { enviado: true, yaEnviado: true };
    }
    console.error("No se pudo registrar el envío de correo en emails_enviados:", errorInsert);
  }

  if (!resultado.ok) {
    return { enviado: false, yaEnviado: false, error: resultado.error };
  }
  return { enviado: true, yaEnviado: false };
}
