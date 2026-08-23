// Gestión de citas por email: consulta (F4) y cancelación (SPEC.md §10.4).
// El correo es la única llave de identidad (S8): quien lo escribe puede
// ver y cancelar sus propias citas. Nunca se inventa ni se supone.

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";
import { borrarEvento } from "../integrations/google-calendar";
import { enviarCorreoTransaccional } from "../email/enviar";
import { plantillaCitaCancelada } from "../email/plantillas/cita-cancelada";
import { formatearFechaLarga, horaHMLima } from "../lib/fechas";
import { ErrorAplicacion } from "../lib/errores";
import type { CitaFormateada, CitaResumen, RespuestaConsultaCitas } from "@/types/dominio";

export async function consultarCitasPorEmail(
  email: string,
  incluirPasadas = false,
): Promise<CitaResumen[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("citas_por_email", {
    p_email: email,
    p_incluir_pasadas: incluirPasadas,
    p_limite: 10,
  });
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al consultar citas: ${error.message}`, 500);
  return (data ?? []).map((c) => ({
    codigo: c.codigo,
    estado: c.estado as CitaResumen["estado"],
    inicio: c.inicio,
    servicio: c.servicio,
    precio: Number(c.precio),
    duracion_minutos: c.duracion_minutos,
    modelo_vehiculo: c.modelo_vehiculo,
    placa: c.placa,
    es_futura: c.es_futura,
  }));
}

/**
 * Formatea las citas de un cliente para presentación (SPEC.md §9.4 T8).
 * Única fuente de esta forma de respuesta: la tool `consultar_citas` del
 * agente y `GET /api/citas` son dos fachadas sobre esta misma función
 * (SPEC.md §4, principio rector — nunca se duplica lógica).
 */
export async function consultarCitasFormateadas(
  email: string,
  incluirPasadas = false,
): Promise<RespuestaConsultaCitas> {
  const citas = await consultarCitasPorEmail(email, incluirPasadas);

  const citasFormateadas: CitaFormateada[] = citas.map((c) => {
    const inicio = new Date(c.inicio);
    return {
      codigo: c.codigo,
      estado: c.estado,
      fecha_legible: formatearFechaLarga(inicio),
      hora: horaHMLima(inicio),
      servicio: c.servicio,
      precio: c.precio,
      vehiculo: `${c.modelo_vehiculo}${c.placa ? ` (${c.placa})` : ""}`,
      es_futura: c.es_futura,
      cancelable: c.estado === "confirmada" && c.es_futura,
    };
  });

  const confirmadasFuturas = citasFormateadas.filter((c) => c.estado === "confirmada" && c.es_futura);
  let sugerencia: string | null = null;
  if (citasFormateadas.length === 0) {
    sugerencia = null; // el runtime usa la plantilla "sin citas para ese correo"
  } else if (confirmadasFuturas.length === 1) {
    sugerencia = "Hay 1 cita confirmada futura. Menciona el código y ofrece cancelarla si lo pide.";
  } else if (confirmadasFuturas.length > 1) {
    sugerencia = `Hay ${confirmadasFuturas.length} citas confirmadas futuras. Si el cliente pide cancelar, pregunta cuál código exacto.`;
  }

  return { encontradas: citasFormateadas.length, citas: citasFormateadas, sugerencia_al_agente: sugerencia };
}

export interface ResultadoCancelacion {
  ok: true;
  codigo: string;
  fechaLegible: string;
  hora: string;
  servicio: string;
  emailEnviado: boolean;
}

export async function cancelarCita(
  codigo: string,
  email: string,
  motivo?: string,
): Promise<ResultadoCancelacion> {
  const db = supabaseAdmin();

  // Primero recuperamos el nombre y el inicio (la función SQL no
  // devuelve el nombre, y "ya pasada" se valida antes de tocar nada).
  const { data: citaPrevia } = await db
    .from("citas")
    .select("nombre_cliente, inicio, estado")
    .eq("codigo", codigo.trim().toUpperCase())
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (citaPrevia?.estado === "confirmada" && new Date(citaPrevia.inicio).getTime() < Date.now()) {
    throw new ErrorAplicacion("CITA_YA_PASADA", "Esa cita ya pasó y no se puede cancelar.", 409);
  }

  const { data, error } = await db.rpc("cancelar_cita", {
    p_codigo: codigo,
    p_email: email,
    p_motivo: motivo ?? null,
  });

  if (error) {
    if (error.message.includes("CITA_NO_CANCELABLE")) {
      throw new ErrorAplicacion(
        "CITA_NO_CANCELABLE",
        "No existe una cita confirmada con ese código y ese correo, o ya fue cancelada/atendida.",
        404,
      );
    }
    throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al cancelar la cita: ${error.message}`, 500);
  }

  const fila = data?.[0];
  if (!fila) {
    throw new ErrorAplicacion("CITA_NO_CANCELABLE", "No se pudo cancelar la cita.", 404);
  }

  if (fila.google_event_id) {
    try {
      await borrarEvento(fila.google_event_id);
    } catch (error) {
      console.error(`No se pudo borrar el evento de Google Calendar ${fila.google_event_id}:`, error);
    }
  }

  const inicio = new Date(fila.inicio);
  let emailEnviado = false;
  try {
    const plantilla = plantillaCitaCancelada({
      codigo: fila.codigo,
      nombreCliente: citaPrevia?.nombre_cliente ?? "cliente",
      servicio: fila.servicio,
      inicio,
    });
    const resultadoEnvio = await enviarCorreoTransaccional({
      tipo: "cita_cancelada",
      referencia: fila.codigo,
      destinatario: { email, nombre: citaPrevia?.nombre_cliente },
      asunto: plantilla.asunto,
      htmlContent: plantilla.htmlContent,
      textContent: plantilla.textContent,
    });
    emailEnviado = resultadoEnvio.enviado;
  } catch (error) {
    console.error(`No se pudo enviar el correo de cancelación para ${fila.codigo}:`, error);
  }

  return {
    ok: true,
    codigo: fila.codigo,
    fechaLegible: formatearFechaLarga(inicio),
    hora: horaHMLima(inicio),
    servicio: fila.servicio,
    emailEnviado,
  };
}
