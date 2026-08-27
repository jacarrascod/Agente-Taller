// Guardrails deterministas (SPEC.md §9.6). Tres capas:
//  1. Antes del LLM: detector de marca ajena + intent de servicio.
//  2. El system prompt (R1, R2) — ver prompt.ts.
//  3. Después del LLM: valida que todo precio/horario citado venga de una tool.

import { negocio } from "../lib/taller";

export const MARCAS_NO_TOYOTA = [
  "nissan",
  "kia",
  "hyundai",
  "chevrolet",
  "honda",
  "suzuki",
  "mazda",
  "ford",
  "volkswagen",
  "vw",
  "renault",
  "peugeot",
  "mitsubishi",
  "subaru",
  "jeep",
  "bmw",
  "mercedes",
  "audi",
  "byd",
  "changan",
  "chery",
  "haval",
  "great wall",
  "jac",
  "mg",
  "citroen",
  "citroën",
  "fiat",
  "dodge",
  "ram",
  "volvo",
  "tesla",
] as const;

const PALABRAS_INTENT_SERVICIO = [
  "repuesto",
  "repuestos",
  "precio",
  "cotiza",
  "cotización",
  "cotizacion",
  "cuesta",
  "cuánto",
  "cuanto",
  "vale",
  "cambio",
  "cambiar",
  "mantenimiento",
  "cita",
  "agenda",
  "agendar",
  "revisar",
  "revisión",
  "revision",
  "taller",
  "arreglar",
  "reparar",
  "comprar",
  "vender",
  "venden",
  "tienen",
  "necesito",
  "quiero",
  "busco",
  "stock",
  "disponible",
  "filtro",
  "pastilla",
  "freno",
  "bateria",
  "batería",
  "bujia",
  "bujía",
  "alternador",
  "radiador",
  "amortiguador",
  "embrague",
  "aceite",
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectarMarcaAjena(mensaje: string): string | null {
  const normalizado = normalizar(mensaje);
  for (const marca of MARCAS_NO_TOYOTA) {
    const patron = new RegExp(`\\b${normalizar(marca)}\\b`, "i");
    if (patron.test(normalizado)) return marca;
  }
  return null;
}

export function tieneIntentDeServicio(mensaje: string): boolean {
  const normalizado = normalizar(mensaje);
  return PALABRAS_INTENT_SERVICIO.some((p) => normalizado.includes(normalizar(p)));
}

export interface ResultadoGuardrailEntrada {
  bloquear: boolean;
  marcaDetectada: string | null;
  recordatorioContexto: string | null;
}

/**
 * Capa 1: si el mensaje trae una marca ajena CON intent de servicio,
 * bloquea con la plantilla "otra marca" sin gastar tokens del LLM. Si trae
 * la marca SIN intent (ej. "vengo de un Nissan, ahora tengo un Corolla"),
 * no bloquea — solo se inyecta un recordatorio de R1 en el turno. Un
 * bloqueo duro ahí sería un falso positivo molesto.
 */
export function evaluarGuardrailEntrada(mensaje: string): ResultadoGuardrailEntrada {
  const marca = detectarMarcaAjena(mensaje);
  if (!marca) return { bloquear: false, marcaDetectada: null, recordatorioContexto: null };

  if (tieneIntentDeServicio(mensaje)) {
    return { bloquear: true, marcaDetectada: marca, recordatorioContexto: null };
  }
  return {
    bloquear: false,
    marcaDetectada: marca,
    recordatorioContexto:
      "El cliente mencionó una marca distinta a Toyota sin pedir cotización ni servicio para ella " +
      "(R1). No la comentes ni la cotices; si el resto del mensaje es sobre un Toyota, atiéndelo con normalidad.",
  };
}

// DEF-03: "le cuesta doscientos diez soles" no lleva el símbolo S/, así que
// esquivaba el filtro. El estilo del system prompt exige SIEMPRE el formato
// "S/ 1,234.56" (§9.1) — "soles" escrito en prosa es o una violación de
// estilo o un precio dictado sin tool, y ambos ameritan descartar la
// respuesta. Se usa el plural ("soles") para no atrapar "el sol" (astro),
// un falso positivo mucho más probable en el singular.
const PATRON_PRECIO = /\bS\/\s?\d|\bsoles\b/i;
const PATRON_HORA = /\b([01]?\d|2[0-3]):[0-5]\d\b/;

function horaFormateada(hora: number): string {
  return `${hora.toString().padStart(2, "0")}:00`;
}

/**
 * El rango fijo de apertura–cierre del taller (ej. "09:00 a 17:00") es un
 * dato del prompt (§3.1), no una hora de cita ofrecida: mencionarlo no
 * requiere respaldo de tool. Se construye desde `negocio`, nunca
 * hardcodeado, y solo exime el rango completo — una hora suelta como
 * "tengo libre a las 09:00" sigue exigiendo la tool (DEF-02).
 */
const PATRON_HORARIO_TALLER = new RegExp(
  `\\b${horaFormateada(negocio.horaApertura)}\\s*(?:a|hasta|[-–—])\\s*${horaFormateada(negocio.horaCierre)}`,
  "i",
);

const TOOLS_QUE_JUSTIFICAN_PRECIO = new Set([
  "buscar_repuestos",
  "consultar_disponibilidad_repuesto",
  "listar_mantenimientos",
  "agendar_cita",
]);
const TOOLS_QUE_JUSTIFICAN_HORA = new Set([
  "consultar_disponibilidad_agenda",
  "agendar_cita",
  "consultar_citas",
  "cancelar_cita",
]);

/**
 * Capa 3: si la respuesta final del modelo cita un precio o un horario sin
 * que en ese turno se haya ejecutado una tool que lo respalde, la
 * respuesta se descarta (SPEC.md §9.6, hace verificable O4).
 */
export function respuestaTieneDatoSinRespaldo(texto: string, toolsEjecutadasEnTurno: string[]): boolean {
  const dijoPrecio = PATRON_PRECIO.test(texto);
  const textoSinHorarioDelTaller = texto.replace(PATRON_HORARIO_TALLER, "");
  const dijoHora = PATRON_HORA.test(textoSinHorarioDelTaller);

  if (dijoPrecio && !toolsEjecutadasEnTurno.some((t) => TOOLS_QUE_JUSTIFICAN_PRECIO.has(t))) {
    return true;
  }
  if (dijoHora && !toolsEjecutadasEnTurno.some((t) => TOOLS_QUE_JUSTIFICAN_HORA.has(t))) {
    return true;
  }
  return false;
}

/**
 * Margen de texto que debe llegar DESPUÉS del dato detectado antes de
 * decidir el corte anticipado. Cumple dos funciones:
 *   1. Deja que "09:00" alcance a completarse como el rango fijo del
 *      taller ("09:00 a 17:00"), que está exento (DEF-02). El separador
 *      más largo que acepta PATRON_HORARIO_TALLER es " hasta 17:00" (12
 *      caracteres), así que 25 da el doble de holgura.
 *   2. Le da al modelo una ventana de gracia para revelar un tool_call
 *      tras un preámbulo en prosa — si lo hace, el guardián de
 *      `toolCallsAcumuladas` en runtime.ts cancela el corte.
 * Subirlo demasiado deja pasar párrafos que ya son violaciones claras
 * (era el defecto de la primera versión, con 40): el corte llegaba tarde
 * y se perdía buena parte del ahorro.
 */
const MARGEN_CORTE_ANTICIPADO = 25;

/**
 * Versión incremental de `respuestaTieneDatoSinRespaldo`, para cortar el
 * stream del LLM apenas la violación es inequívoca en vez de esperar a
 * que termine de generar el párrafo entero (ver runtime.ts). Usa el MISMO
 * criterio de respaldo: no cambia qué se considera respaldado, solo
 * cuándo se evalúa. Ante la duda devuelve `false` (esperar más texto);
 * la evaluación definitiva sigue siendo la de texto completo.
 */
export function respuestaParcialTieneDatoSinRespaldo(
  textoParcial: string,
  toolsEjecutadasEnTurno: string[],
): boolean {
  const matchPrecio = PATRON_PRECIO.exec(textoParcial);
  if (matchPrecio && !toolsEjecutadasEnTurno.some((t) => TOOLS_QUE_JUSTIFICAN_PRECIO.has(t))) {
    if (textoParcial.length - (matchPrecio.index + matchPrecio[0].length) >= MARGEN_CORTE_ANTICIPADO) {
      return true;
    }
  }

  const matchHora = PATRON_HORA.exec(textoParcial);
  if (!matchHora) return false;
  if (textoParcial.length - (matchHora.index + matchHora[0].length) < MARGEN_CORTE_ANTICIPADO) {
    return false;
  }
  const textoSinHorarioDelTaller = textoParcial.replace(PATRON_HORARIO_TALLER, "");
  return (
    PATRON_HORA.test(textoSinHorarioDelTaller) &&
    !toolsEjecutadasEnTurno.some((t) => TOOLS_QUE_JUSTIFICAN_HORA.has(t))
  );
}

/**
 * Capa 3 (defecto DEF-24 de INFORME-E2E-NAVEGACION-REAL.md): navegando en
 * vivo contra el LLM real se observó que el modelo a veces repite, carácter
 * por carácter, su respuesta del turno anterior en vez de atender el
 * mensaje nuevo del cliente — un fallo de atención del modelo, no del
 * ensamblado de mensajes (el mensaje nuevo sí llega correcto en el
 * request). Se detecta comparando el texto final contra el último turno
 * del asistente en el historial: si son iguales y el mensaje del cliente
 * cambió, la respuesta no atendió lo que se le preguntó.
 */
export function respuestaEsEcoDelTurnoAnterior(
  texto: string,
  historial: { rol: "user" | "assistant"; contenido: string }[],
  mensajeNuevo: string,
): boolean {
  const ultimoAsistente = [...historial].reverse().find((t) => t.rol === "assistant");
  const ultimoUsuario = [...historial].reverse().find((t) => t.rol === "user");
  if (!ultimoAsistente || !ultimoUsuario) return false;

  const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const mismaRespuesta = normalizar(texto) === normalizar(ultimoAsistente.contenido);
  const mismaPregunta = normalizar(mensajeNuevo) === normalizar(ultimoUsuario.contenido);

  return mismaRespuesta && !mismaPregunta;
}
