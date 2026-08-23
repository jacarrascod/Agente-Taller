// Sesión e historial del chat en localStorage (SPEC.md §12.4).

export interface MensajeChat {
  id: string;
  rol: "user" | "assistant";
  contenido: string;
  toolsUsadas?: string[];
  citas?: import("@/types/dominio").CitaFormateada[];
  repuestos?: { sku: string; nombre: string; precio: number; imagen_url: string; url: string }[];
}

const CLAVE_SESION = "ttp_chat_session_id";
const CLAVE_HISTORIAL = "ttp_chat_historial";
const TOPE_HISTORIAL = 50;

export function obtenerSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CLAVE_SESION);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(CLAVE_SESION, id);
  }
  return id;
}

export function leerHistorialChat(): MensajeChat[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE_HISTORIAL);
    if (!crudo) return [];
    const historial = JSON.parse(crudo);
    return Array.isArray(historial) ? historial : [];
  } catch {
    return [];
  }
}

export function guardarHistorialChat(mensajes: MensajeChat[]): void {
  if (typeof window === "undefined") return;
  const recortado = mensajes.slice(-TOPE_HISTORIAL);
  window.localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(recortado));
}

export function esPrimeraVisita(): boolean {
  if (typeof window === "undefined") return false;
  const clave = "ttp_chat_visitado";
  if (window.localStorage.getItem(clave)) return false;
  window.localStorage.setItem(clave, "1");
  return true;
}
