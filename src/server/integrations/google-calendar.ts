// Integración con Google Calendar API v3 vía cuenta de servicio
// (SPEC.md §10). Sin login interactivo, sin `attendees` (una cuenta Gmail
// gratuita no puede delegar dominio). El cliente se entera de su cita por
// el correo de Brevo, no por una invitación de Google.
//
// Proveedor `mock` (CALENDAR_PROVIDER=mock): no llama a Google. Permite
// desarrollar y demostrar la funcionalidad completa sin credenciales.

import "server-only";
import { google } from "googleapis";
import fs from "node:fs";
import { taller } from "../lib/taller";

export interface EventoCalendar {
  titulo: string;
  descripcion: string;
  inicioIso: string;
  finIso: string;
}

export interface RangoOcupado {
  inicio: string;
  fin: string;
}

function proveedor(): "google" | "mock" {
  const valor = (process.env.CALENDAR_PROVIDER ?? "mock").toLowerCase();
  return valor === "google" ? "google" : "mock";
}

function credencialesServiceAccount(): { email: string; privateKey: string } {
  const archivo = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (archivo && fs.existsSync(archivo)) {
    const json = JSON.parse(fs.readFileSync(archivo, "utf-8"));
    return { email: json.client_email, privateKey: json.private_key };
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKeyRaw) {
    throw new Error(
      "Faltan credenciales de Google (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SERVICE_ACCOUNT_FILE).",
    );
  }
  return { email, privateKey: privateKeyRaw.replace(/\\n/g, "\n") };
}

function calendarioId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("Falta GOOGLE_CALENDAR_ID.");
  return id;
}

async function clienteCalendar() {
  const { email, privateKey } = credencialesServiceAccount();
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  await auth.authorize();
  return google.calendar({ version: "v3", auth });
}

/** Rangos ocupados del calendario del taller en [desdeIso, hastaIso). */
export async function consultarOcupado(desdeIso: string, hastaIso: string): Promise<RangoOcupado[]> {
  if (proveedor() === "mock") return [];

  const calendar = await clienteCalendar();
  const calId = calendarioId();
  const respuesta = await calendar.freebusy.query({
    requestBody: {
      timeMin: desdeIso,
      timeMax: hastaIso,
      items: [{ id: calId }],
    },
  });
  const ocupados = respuesta.data.calendars?.[calId]?.busy ?? [];
  return ocupados
    .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
    .map((b) => ({ inicio: b.start, fin: b.end }));
}

/** Crea el evento de la cita. Devuelve el `eventId`, o `null` en modo mock. */
export async function crearEvento(evento: EventoCalendar): Promise<string | null> {
  if (proveedor() === "mock") return null;

  const calendar = await clienteCalendar();
  const respuesta = await calendar.events.insert({
    calendarId: calendarioId(),
    requestBody: {
      summary: evento.titulo,
      description: evento.descripcion,
      start: { dateTime: evento.inicioIso, timeZone: "America/Lima" },
      end: { dateTime: evento.finIso, timeZone: "America/Lima" },
    },
  });
  return respuesta.data.id ?? null;
}

/** Borra el evento. Ignora 404/410 (ya no existe); cualquier otro error se propaga. */
export async function borrarEvento(eventId: string): Promise<void> {
  if (proveedor() === "mock") return;

  const calendar = await clienteCalendar();
  try {
    await calendar.events.delete({ calendarId: calendarioId(), eventId });
  } catch (error) {
    const status = (error as { code?: number; response?: { status?: number } })?.response?.status ??
      (error as { code?: number })?.code;
    if (status === 404 || status === 410) return;
    throw error;
  }
}

export function formatearDescripcionEvento(datos: {
  nombreCliente: string;
  telefono: string;
  email: string;
  vehiculo: string;
  servicio: string;
  precioTexto: string;
  codigo: string;
}): string {
  return [
    `Cliente: ${datos.nombreCliente}`,
    `Teléfono: ${datos.telefono}`,
    `Email: ${datos.email}`,
    `Vehículo: ${datos.vehiculo}`,
    `Servicio: ${datos.servicio} — ${datos.precioTexto}`,
    `Código: ${datos.codigo}`,
    `Origen: Chat del agente`,
    ``,
    `${taller.nombre} — ${taller.direccion}`,
  ].join("\n");
}
