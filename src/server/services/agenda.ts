// Disponibilidad y creación de citas (SPEC.md §10.2, §10.3).
// Orden de la creación: Supabase → Google Calendar → correo. Un fallo en
// un eslabón nunca invalida los anteriores (jerarquía de fuentes de verdad).

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";
import { consultarOcupado, crearEvento, formatearDescripcionEvento } from "../integrations/google-calendar";
import { enviarCorreoTransaccional } from "../email/enviar";
import { plantillaCitaConfirmada } from "../email/plantillas/cita-confirmada";
import {
  construirInstanteLima,
  cumpleAnticipacionMinima,
  dentroDeVentanaAgenda,
  esDiaLaborableYMD,
  generarSlotsCandidatos,
  nombreDiaSemanaLima,
  siguienteDiaHabilYMD,
  formatearFechaCorta,
  formatearFechaLarga,
  horaHMLima,
} from "../lib/fechas";
import { negocio, taller } from "../lib/taller";
import { ErrorAplicacion } from "../lib/errores";
import { obtenerMantenimientoPorSlug } from "./catalogo";
import type { DiaAgenda, RespuestaDisponibilidad, SlotAgenda } from "@/types/dominio";

function sumarDiasYMD(fechaYMD: string, dias: number): string {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const nueva = new Date(base.getTime() + dias * 86_400_000);
  return `${nueva.getUTCFullYear()}-${(nueva.getUTCMonth() + 1).toString().padStart(2, "0")}-${nueva
    .getUTCDate()
    .toString()
    .padStart(2, "0")}`;
}

async function citasConfirmadasDelDia(fechaYMD: string): Promise<Set<string>> {
  const db = supabaseAdmin();
  const inicioDia = construirInstanteLima(fechaYMD, 0, 0);
  const finDia = construirInstanteLima(sumarDiasYMD(fechaYMD, 1), 0, 0);
  const { data, error } = await db
    .from("citas")
    .select("inicio")
    .eq("estado", "confirmada")
    .gte("inicio", inicioDia.toISOString())
    .lt("inicio", finDia.toISOString());
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al consultar citas: ${error.message}`, 500);
  return new Set((data ?? []).map((c) => new Date(c.inicio).toISOString()));
}

async function calcularDia(fechaYMD: string, ahora: Date): Promise<DiaAgenda> {
  const fechaRef = construirInstanteLima(fechaYMD, 12, 0); // mediodía, solo para nombrar el día
  const diaSemana = nombreDiaSemanaLima(fechaRef);

  if (!esDiaLaborableYMD(fechaYMD)) {
    return {
      fecha: fechaYMD,
      dia_semana: diaSemana,
      laborable: false,
      slots: [],
      total_libres: 0,
      motivo: "fin_de_semana",
      siguiente_habil: siguienteDiaHabilYMD(fechaYMD),
    };
  }
  if (!dentroDeVentanaAgenda(fechaYMD, ahora)) {
    return {
      fecha: fechaYMD,
      dia_semana: diaSemana,
      laborable: false,
      slots: [],
      total_libres: 0,
      motivo: "fuera_de_ventana",
    };
  }

  const candidatos = generarSlotsCandidatos(fechaYMD);
  const inicioDia = construirInstanteLima(fechaYMD, 0, 0);
  const finDia = construirInstanteLima(sumarDiasYMD(fechaYMD, 1), 0, 0);

  const [ocupadoGoogle, confirmadasSupabase] = await Promise.all([
    consultarOcupado(inicioDia.toISOString(), finDia.toISOString()),
    citasConfirmadasDelDia(fechaYMD),
  ]);

  const slots: SlotAgenda[] = candidatos.map((c) => {
    const finSlot = new Date(c.inicio.getTime() + negocio.duracionCitaMin * 60_000);
    const solapaGoogle = ocupadoGoogle.some((r) => {
      const rInicio = new Date(r.inicio).getTime();
      const rFin = new Date(r.fin).getTime();
      return c.inicio.getTime() < rFin && finSlot.getTime() > rInicio;
    });
    const ocupadoSupabase = confirmadasSupabase.has(c.inicio.toISOString());
    const cumpleAnticipacion = cumpleAnticipacionMinima(c.inicio, ahora);
    return {
      hora: c.hora,
      iso: c.iso,
      libre: !solapaGoogle && !ocupadoSupabase && cumpleAnticipacion,
    };
  });

  return {
    fecha: fechaYMD,
    dia_semana: diaSemana,
    laborable: true,
    slots,
    total_libres: slots.filter((s) => s.libre).length,
  };
}

export async function consultarDisponibilidad(
  fechaYMD: string,
  fechaHastaYMD?: string,
  ahora: Date = new Date(),
): Promise<RespuestaDisponibilidad> {
  const dias: string[] = [fechaYMD];
  if (fechaHastaYMD && fechaHastaYMD > fechaYMD) {
    let cursor = fechaYMD;
    for (let i = 0; i < 6 && cursor < fechaHastaYMD; i++) {
      cursor = sumarDiasYMD(cursor, 1);
      dias.push(cursor);
    }
  }

  const resultados = await Promise.all(dias.map((d) => calcularDia(d, ahora)));

  let mensaje: string | null = null;
  const primero = resultados[0];
  if (!primero.laborable) {
    if (primero.motivo === "fin_de_semana") {
      mensaje = `El taller no atiende el ${primero.dia_semana} ${fechaYMD}. El siguiente día hábil es ${
        primero.siguiente_habil ? formatearFechaCorta(construirInstanteLima(primero.siguiente_habil, 12, 0)) : ""
      }.`;
    } else if (primero.motivo === "fuera_de_ventana") {
      mensaje = `Solo se puede agendar hasta ${negocio.ventanaAgendaDias} días por adelantado.`;
    }
  } else if (primero.total_libres === 0) {
    mensaje = "No hay horarios libres ese día. Puede probar con otra fecha.";
  }

  return { dias: resultados, mensaje };
}

export interface DatosAgendarCita {
  inicioIso: string;
  mantenimientoSlug: string;
  nombreCliente: string;
  email: string;
  telefono: string;
  modeloVehiculo: string;
  anioVehiculo?: number;
  placa?: string;
  notas?: string;
  origen?: "chat" | "web";
}

export interface ResultadoAgendarOk {
  ok: true;
  codigo: string;
  inicioLegible: string;
  servicio: string;
  precio: number;
  googleEventId: string | null;
  emailEnviado: boolean;
  emailDestino: string;
  direccion: string;
}

export interface ResultadoAgendarConflicto {
  ok: false;
  error: "SLOT_OCUPADO";
  alternativas: string[];
}

async function alternativasParaFecha(fechaYMD: string, ahora: Date): Promise<string[]> {
  const dia = await calcularDia(fechaYMD, ahora);
  return dia.slots.filter((s) => s.libre).map((s) => s.hora).slice(0, 3);
}

export async function agendarCita(
  datos: DatosAgendarCita,
  ahora: Date = new Date(),
): Promise<ResultadoAgendarOk | ResultadoAgendarConflicto> {
  const mantenimiento = await obtenerMantenimientoPorSlug(datos.mantenimientoSlug);
  if (!mantenimiento) {
    throw new ErrorAplicacion("REPUESTO_NO_ENCONTRADO", `Servicio de mantenimiento desconocido: ${datos.mantenimientoSlug}`, 404);
  }

  const inicio = new Date(datos.inicioIso);
  if (Number.isNaN(inicio.getTime())) {
    throw new ErrorAplicacion("FUERA_DE_HORARIO", "La fecha/hora de inicio no es válida.", 400);
  }
  const fechaYMD = datos.inicioIso.slice(0, 10);

  // Revalidación previa (el cliente pudo demorar en confirmar).
  const dia = await calcularDia(fechaYMD, ahora);
  const slotVigente = dia.slots.find((s) => s.iso === datos.inicioIso);
  if (!dia.laborable || !slotVigente || !slotVigente.libre) {
    return { ok: false, error: "SLOT_OCUPADO", alternativas: await alternativasParaFecha(fechaYMD, ahora) };
  }

  const fin = new Date(inicio.getTime() + negocio.duracionCitaMin * 60_000);
  const db = supabaseAdmin();

  const { data: citaInsertada, error: errorInsert } = await db
    .from("citas")
    .insert({
      nombre_cliente: datos.nombreCliente,
      email: datos.email,
      telefono: datos.telefono,
      modelo_vehiculo: datos.modeloVehiculo,
      anio_vehiculo: datos.anioVehiculo ?? null,
      placa: datos.placa ?? null,
      mantenimiento_id: mantenimiento.id,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      origen: datos.origen ?? "chat",
      notas: datos.notas ?? null,
    })
    .select("codigo, email")
    .single();

  if (errorInsert) {
    // 23505 = violación de índice único (citas_slot_unico): otro cliente ganó la carrera.
    if (errorInsert.code === "23505") {
      return { ok: false, error: "SLOT_OCUPADO", alternativas: await alternativasParaFecha(fechaYMD, ahora) };
    }
    throw new ErrorAplicacion("FUERA_DE_HORARIO", `No se pudo registrar la cita: ${errorInsert.message}`, 400);
  }

  const codigo = citaInsertada.codigo;

  // Google Calendar: un fallo aquí no revierte la cita (Supabase es la
  // fuente de verdad operativa). Se deja `google_event_id` en null.
  let googleEventId: string | null = null;
  try {
    googleEventId = await crearEvento({
      titulo: `[Cita] ${mantenimiento.nombre} — ${datos.nombreCliente}`,
      descripcion: formatearDescripcionEvento({
        nombreCliente: datos.nombreCliente,
        telefono: datos.telefono,
        email: datos.email,
        vehiculo: `${datos.modeloVehiculo}${datos.anioVehiculo ? ` ${datos.anioVehiculo}` : ""}${
          datos.placa ? ` (Placa ${datos.placa})` : ""
        }`,
        servicio: mantenimiento.nombre,
        precioTexto: `S/ ${mantenimiento.precio.toFixed(2)}`,
        codigo,
      }),
      inicioIso: inicio.toISOString(),
      finIso: fin.toISOString(),
    });
    if (googleEventId) {
      await db.from("citas").update({ google_event_id: googleEventId }).eq("codigo", codigo);
    }
  } catch (error) {
    console.error(`No se pudo crear el evento de Google Calendar para ${codigo}:`, error);
  }

  // Correo: un fallo aquí tampoco invalida la cita.
  let emailEnviado = false;
  try {
    const plantilla = plantillaCitaConfirmada({
      codigo,
      nombreCliente: datos.nombreCliente,
      servicio: mantenimiento.nombre,
      precio: mantenimiento.precio,
      duracionMinutos: mantenimiento.duracion_minutos,
      inicio,
    });
    const resultadoEnvio = await enviarCorreoTransaccional({
      tipo: "cita_confirmada",
      referencia: codigo,
      destinatario: { email: datos.email, nombre: datos.nombreCliente },
      asunto: plantilla.asunto,
      htmlContent: plantilla.htmlContent,
      textContent: plantilla.textContent,
    });
    emailEnviado = resultadoEnvio.enviado;
  } catch (error) {
    console.error(`No se pudo enviar el correo de confirmación para ${codigo}:`, error);
  }

  return {
    ok: true,
    codigo,
    inicioLegible: `${formatearFechaLarga(inicio)}, ${horaHMLima(inicio)}`,
    servicio: mantenimiento.nombre,
    precio: mantenimiento.precio,
    googleEventId,
    emailEnviado,
    emailDestino: datos.email,
    direccion: taller.direccion,
  };
}
