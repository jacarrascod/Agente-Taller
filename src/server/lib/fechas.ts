// Utilidades de fecha/hora, siempre ancladas a America/Lima (SPEC.md §10.5).
//
// El servidor puede correr en UTC (Render lo hace por defecto). Ninguna
// función de este módulo usa los getters locales de `Date` para lógica de
// negocio: todo pasa por `Intl` con `timeZone` explícito o por
// `fromZonedTime`/`formatInTimeZone` de date-fns-tz, que son correctos sin
// importar la zona horaria del proceso.

import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { negocio } from "./taller";

export const ZONA_LIMA = negocio.zonaHoraria;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

interface PartesFecha {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partesEnZona(fecha: Date, zona: string): PartesFecha {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const partes = fmt.formatToParts(fecha);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "0";
  const hora = Number(get("hour"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hora === 24 ? 0 : hora, // quirk de ICU: medianoche a veces sale como "24"
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** "YYYY-MM-DD" de una fecha, leído en hora de Lima. */
export function fechaYMDLima(fecha: Date = new Date()): string {
  const p = partesEnZona(fecha, ZONA_LIMA);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** "HH:mm" de una fecha, leído en hora de Lima. */
export function horaHMLima(fecha: Date): string {
  const p = partesEnZona(fecha, ZONA_LIMA);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Día ISO de la semana (1=lunes … 7=domingo) de una fecha en hora de Lima. */
export function diaSemanaIsoLima(fecha: Date): number {
  const p = partesEnZona(fecha, ZONA_LIMA);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0=domingo
  return dow === 0 ? 7 : dow;
}

/** ¿"YYYY-MM-DD" cae en un día laborable del taller? Cálculo puramente calendario. */
export function esDiaLaborableYMD(fechaYMD: string): boolean {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const iso = dow === 0 ? 7 : dow;
  return negocio.diasLaborables.includes(iso);
}

function sumarDiaYMD(fechaYMD: string, dias: number): string {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const nueva = new Date(base.getTime() + dias * 86_400_000);
  return `${nueva.getUTCFullYear()}-${pad2(nueva.getUTCMonth() + 1)}-${pad2(nueva.getUTCDate())}`;
}

/** Siguiente día hábil (estrictamente posterior) a partir de "YYYY-MM-DD". */
export function siguienteDiaHabilYMD(fechaYMD: string): string {
  let cursor = sumarDiaYMD(fechaYMD, 1);
  while (!esDiaLaborableYMD(cursor)) {
    cursor = sumarDiaYMD(cursor, 1);
  }
  return cursor;
}

/**
 * Construye el instante UTC exacto correspondiente a una hora de reloj de
 * pared en Lima (ej. "2026-08-25" a las 9 → 2026-08-25T14:00:00.000Z).
 * Funciona sin importar la zona horaria del sistema operativo del proceso.
 */
export function construirInstanteLima(fechaYMD: string, hora: number, minuto = 0): Date {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  return fromZonedTime(new Date(y, m - 1, d, hora, minuto, 0, 0), ZONA_LIMA);
}

/** ISO 8601 con el offset de Lima (-05:00), ej. "2026-08-25T09:00:00-05:00". */
export function isoConOffsetLima(fecha: Date): string {
  return formatInTimeZone(fecha, ZONA_LIMA, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export interface SlotCandidato {
  hora: string; // "09:00"
  iso: string; // con offset de Lima
  inicio: Date; // instante UTC real
}

/** Los slots candidatos de un día (09:00 a 16:00, 8 bloques de 1 hora). */
export function generarSlotsCandidatos(fechaYMD: string): SlotCandidato[] {
  const slots: SlotCandidato[] = [];
  for (let h = negocio.horaApertura; h < negocio.horaCierre; h++) {
    const inicio = construirInstanteLima(fechaYMD, h, 0);
    slots.push({ hora: `${pad2(h)}:00`, iso: isoConOffsetLima(inicio), inicio });
  }
  return slots;
}

/** ¿El instante respeta la anticipación mínima respecto de "ahora"? */
export function cumpleAnticipacionMinima(inicio: Date, ahora: Date = new Date()): boolean {
  const minimo = ahora.getTime() + negocio.anticipacionMinimaHoras * 60 * 60 * 1000;
  return inicio.getTime() >= minimo;
}

/** ¿"YYYY-MM-DD" cae dentro de la ventana de agenda permitida desde hoy? */
export function dentroDeVentanaAgenda(fechaYMD: string, ahora: Date = new Date()): boolean {
  const hoy = fechaYMDLima(ahora);
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const [y2, m2, d2] = hoy.split("-").map(Number);
  const diffDias = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000,
  );
  return diffDias >= 0 && diffDias <= negocio.ventanaAgendaDias;
}

function formatearIntl(fecha: Date, opciones: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-PE", { timeZone: ZONA_LIMA, ...opciones }).format(fecha);
}

/** "lunes" — nombre del día de la semana en español, hora de Lima. */
export function nombreDiaSemanaLima(fecha: Date): string {
  return formatearIntl(fecha, { weekday: "long" });
}

/** "lunes 25 de agosto de 2026" */
export function formatearFechaLarga(fecha: Date): string {
  const fmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: ZONA_LIMA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const partes = fmt.formatToParts(fecha);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} de ${get("month")} de ${get("year")}`;
}

/** "lunes 25 de agosto" (sin año, para mensajes cortos) */
export function formatearFechaCorta(fecha: Date): string {
  const fmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: ZONA_LIMA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const partes = fmt.formatToParts(fecha);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} de ${get("month")}`;
}

/** "lunes 25 de agosto de 2026, 11:00 h (hora de Lima)" — para correos. */
export function formatearFechaHoraLargaEmail(fecha: Date): string {
  return `${formatearFechaLarga(fecha)}, ${horaHMLima(fecha)} h (hora de Lima)`;
}

/**
 * Bloque de contexto dinámico que se inyecta en cada turno del agente
 * (SPEC.md §9.5, paso 3): fecha/hora actual y el próximo día hábil.
 */
export function bloqueContextoFechaActual(ahora: Date = new Date()): string {
  const hoyYMD = fechaYMDLima(ahora);
  const proximoHabilYMD = siguienteDiaHabilYMD(hoyYMD);
  const [y, m, d] = proximoHabilYMD.split("-").map(Number);
  const proximoHabilFecha = new Date(Date.UTC(y, m - 1, d, 12)); // mediodía UTC, solo para formatear el nombre
  return (
    `Fecha y hora actual: ${formatearFechaLarga(ahora)}, ${horaHMLima(ahora)} (America/Lima).\n` +
    `Próximo día hábil: ${formatearFechaCorta(proximoHabilFecha)}.`
  );
}
