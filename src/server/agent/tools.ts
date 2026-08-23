// Las 9 tools del agente (SPEC.md §9.4): JSON Schema para el LLM +
// dispatcher que valida con Zod y ejecuta el servicio correspondiente.
// Las tools y los endpoints REST de la UI son dos fachadas sobre los
// mismos servicios (SPEC.md §4) — nunca se duplica lógica de negocio aquí.

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  zAgendarCita,
  zAgregarAlCarrito,
  zBuscarConocimiento,
  zBuscarRepuestos,
  zCancelarCita,
  zConsultarCitas,
  zConsultarDisponibilidadAgenda,
  zConsultarDisponibilidadRepuesto,
} from "../lib/validacion";
import { buscarRepuestos, evaluarAmbiguedad, obtenerRepuestoPorSku, listarMantenimientos } from "../services/catalogo";
import { agendarCita, consultarDisponibilidad } from "../services/agenda";
import { buscarConocimiento } from "../services/conocimiento";
import { consultarCitasFormateadas, cancelarCita } from "../services/citas";
import { ErrorAplicacion } from "../lib/errores";
import { taller } from "../lib/taller";

export const TOOLS_JSON_SCHEMA: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_repuestos",
      description:
        "Busca repuestos en el catálogo por descripción libre, modelo y año. Úsala cuando el cliente menciona una pieza. Devuelve precio y stock reales.",
      parameters: {
        type: "object",
        properties: {
          consulta: { type: "string", description: "Qué busca el cliente, en sus palabras. Ej: 'pastillas de freno delanteras'" },
          modelo: { type: "string", description: "Modelo Toyota: Corolla, Yaris, Hilux, RAV4, Fortuner, Prius, Camry, Land Cruiser, Rush, Avanza" },
          anio: { type: "integer", minimum: 1990, maximum: 2027 },
          categoria: {
            type: "string",
            enum: ["filtros", "frenos", "motor", "suspension", "electrico", "lubricantes", "transmision", "accesorios"],
          },
          limite: { type: "integer", default: 5, maximum: 10 },
        },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad_repuesto",
      description: "Consulta stock y precio exactos de un SKU concreto ya identificado.",
      parameters: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_mantenimientos",
      description: "Devuelve los 3 servicios del taller con precio, duración e ítems incluidos. Sin parámetros.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad_agenda",
      description: "Devuelve los horarios libres. Úsala ANTES de ofrecer cualquier hora.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD (hora de Lima)" },
          fecha_hasta: { type: "string", description: "Opcional. Para consultar un rango de hasta 7 días." },
        },
        required: ["fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_cita",
      description: "Registra la cita. Solo tras confirmación explícita del cliente (R5).",
      parameters: {
        type: "object",
        properties: {
          inicio_iso: { type: "string", description: "Inicio en ISO 8601 con offset de Lima, tomado tal cual de consultar_disponibilidad_agenda" },
          mantenimiento_slug: { type: "string", enum: ["express-5k", "preventivo-20k", "mayor-40k"] },
          nombre_cliente: { type: "string" },
          email: { type: "string" },
          telefono: { type: "string" },
          modelo_vehiculo: { type: "string" },
          anio_vehiculo: { type: "integer" },
          placa: { type: "string" },
          notas: { type: "string" },
        },
        required: ["inicio_iso", "mantenimiento_slug", "nombre_cliente", "email", "telefono", "modelo_vehiculo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_conocimiento",
      description: "Base de conocimiento sobre repuestos y mantenimiento Toyota. Úsala para toda pregunta técnica antes de responder.",
      parameters: {
        type: "object",
        properties: { consulta: { type: "string" }, modelo: { type: "string" } },
        required: ["consulta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description:
        "Agrega un repuesto al carrito de compra del cliente. Llama a esta tool SIEMPRE que el " +
        "cliente confirme que quiere agregar, comprar o llevar un repuesto que ya identificaste " +
        "(ej. dice 'sí', 'agrégalo', 'lo quiero', 'échalo al carrito'). No lo des por hecho ni lo " +
        "digas sin haber llamado a esta tool: el carrito solo cambia cuando la ejecutas.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          cantidad: { type: "integer", default: 1 },
        },
        required: ["sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_citas",
      description:
        "Busca las citas de un cliente usando su correo electrónico. Úsala cuando el cliente pregunte si tiene una cita, cuándo es, o quiera cancelarla. El correo debe haberlo escrito él; nunca lo inventes.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Correo tal como lo escribió el cliente" },
          incluir_pasadas: { type: "boolean", default: false, description: "true si el cliente pregunta por su historial" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_cita",
      description: "Cancela una cita confirmada. Libera el horario y borra el evento del calendario. Solo tras doble confirmación explícita (R8).",
      parameters: {
        type: "object",
        properties: {
          codigo: { type: "string", description: "Código exacto devuelto por consultar_citas, ej. CITA-2026-0007" },
          email: { type: "string", description: "El mismo correo con el que se encontró la cita" },
          motivo: { type: "string", description: "Opcional, si el cliente lo menciona" },
        },
        required: ["codigo", "email"],
      },
    },
  },
];

export const NOMBRES_TOOLS = TOOLS_JSON_SCHEMA.map((t) => t.function.name);

export interface ResultadoTool {
  resultado: unknown;
  esError: boolean;
}

async function ejecutarBuscarRepuestos(argsCrudos: unknown): Promise<unknown> {
  const args = zBuscarRepuestos.parse(argsCrudos);
  const resultados = await buscarRepuestos(args);
  const sugerencia = evaluarAmbiguedad(resultados, args);
  return {
    encontrados: resultados.length,
    resultados: resultados.map((r) => ({
      sku: r.sku,
      nombre: r.nombre,
      precio: r.precio,
      moneda: "PEN",
      stock_disponible: r.stock_disponible,
      estado_stock: r.estado_stock,
      compatibilidad: r.compatibilidad,
      url: `/repuestos/${r.slug}`,
      imagen_url: r.imagen_url,
    })),
    sugerencia_al_agente: sugerencia,
  };
}

async function ejecutarConsultarDisponibilidadRepuesto(argsCrudos: unknown): Promise<unknown> {
  const args = zConsultarDisponibilidadRepuesto.parse(argsCrudos);
  const repuesto = await obtenerRepuestoPorSku(args.sku);
  if (!repuesto) {
    throw new ErrorAplicacion("REPUESTO_NO_ENCONTRADO", `No existe el repuesto con SKU ${args.sku}.`, 404);
  }
  return {
    sku: repuesto.sku,
    nombre: repuesto.nombre,
    precio: repuesto.precio,
    stock_disponible: repuesto.stock_disponible,
    estado_stock: repuesto.estado_stock,
    dias_reposicion: repuesto.dias_reposicion,
    ubicacion_publica: repuesto.ubicacion_publica,
    url: `/repuestos/${repuesto.slug}`,
  };
}

async function ejecutarListarMantenimientos(): Promise<unknown> {
  const mantenimientos = await listarMantenimientos();
  return {
    mantenimientos: mantenimientos.map((m) => ({
      slug: m.slug,
      nombre: m.nombre,
      descripcion: m.descripcion,
      precio: m.precio,
      duracion_minutos: m.duracion_minutos,
      intervalo_km: m.intervalo_km,
      incluye: m.incluye,
    })),
  };
}

async function ejecutarConsultarDisponibilidadAgenda(argsCrudos: unknown): Promise<unknown> {
  const args = zConsultarDisponibilidadAgenda.parse(argsCrudos);
  return consultarDisponibilidad(args.fecha, args.fecha_hasta);
}

async function ejecutarAgendarCita(argsCrudos: unknown): Promise<unknown> {
  const args = zAgendarCita.parse(argsCrudos);
  const resultado = await agendarCita({
    inicioIso: args.inicio_iso,
    mantenimientoSlug: args.mantenimiento_slug,
    nombreCliente: args.nombre_cliente,
    email: args.email,
    telefono: args.telefono,
    modeloVehiculo: args.modelo_vehiculo,
    anioVehiculo: args.anio_vehiculo,
    placa: args.placa,
    notas: args.notas,
    origen: "chat",
  });

  if (!resultado.ok) {
    return { ok: false, error: resultado.error, alternativas: resultado.alternativas };
  }

  return {
    ok: true,
    codigo: resultado.codigo,
    inicio_legible: resultado.inicioLegible,
    servicio: resultado.servicio,
    precio: resultado.precio,
    google_event_id: resultado.googleEventId,
    email_enviado: resultado.emailEnviado,
    email_destino: resultado.emailDestino,
    direccion: taller.direccion,
  };
}

async function ejecutarBuscarConocimiento(argsCrudos: unknown): Promise<unknown> {
  const args = zBuscarConocimiento.parse(argsCrudos);
  const resultados = await buscarConocimiento(args.consulta);
  return {
    resultados: resultados.map((r) => ({ pregunta: r.pregunta, respuesta: r.respuesta, categoria: r.categoria })),
    hay_respuesta: resultados.length > 0,
  };
}

async function ejecutarAgregarAlCarrito(argsCrudos: unknown): Promise<unknown> {
  const args = zAgregarAlCarrito.parse(argsCrudos);
  const repuesto = await obtenerRepuestoPorSku(args.sku);
  if (!repuesto) {
    throw new ErrorAplicacion("REPUESTO_NO_ENCONTRADO", `No existe el repuesto con SKU ${args.sku}.`, 404);
  }
  return {
    ok: true,
    sku: repuesto.sku,
    nombre: repuesto.nombre,
    precio: repuesto.precio,
    cantidad: args.cantidad,
    stock_disponible: repuesto.stock_disponible,
    url_carrito: "/carrito",
  };
}

async function ejecutarConsultarCitas(argsCrudos: unknown): Promise<unknown> {
  const args = zConsultarCitas.parse(argsCrudos);
  return consultarCitasFormateadas(args.email, args.incluir_pasadas ?? false);
}

async function ejecutarCancelarCita(argsCrudos: unknown): Promise<unknown> {
  const args = zCancelarCita.parse(argsCrudos);
  const resultado = await cancelarCita(args.codigo, args.email, args.motivo);
  return {
    ok: true,
    codigo: resultado.codigo,
    fecha_legible: resultado.fechaLegible,
    hora: resultado.hora,
    servicio: resultado.servicio,
    email_enviado: resultado.emailEnviado,
  };
}

const DISPATCHERS: Record<string, (argsCrudos: unknown) => Promise<unknown>> = {
  buscar_repuestos: ejecutarBuscarRepuestos,
  consultar_disponibilidad_repuesto: ejecutarConsultarDisponibilidadRepuesto,
  listar_mantenimientos: ejecutarListarMantenimientos,
  consultar_disponibilidad_agenda: ejecutarConsultarDisponibilidadAgenda,
  agendar_cita: ejecutarAgendarCita,
  buscar_conocimiento: ejecutarBuscarConocimiento,
  agregar_al_carrito: ejecutarAgregarAlCarrito,
  consultar_citas: ejecutarConsultarCitas,
  cancelar_cita: ejecutarCancelarCita,
};

export async function ejecutarTool(nombre: string, argsCrudos: unknown): Promise<ResultadoTool> {
  const dispatcher = DISPATCHERS[nombre];
  if (!dispatcher) {
    return { resultado: { error: `Tool desconocida: ${nombre}` }, esError: true };
  }
  try {
    const resultado = await dispatcher(argsCrudos);
    return { resultado, esError: false };
  } catch (error) {
    if (error instanceof ErrorAplicacion) {
      return { resultado: error.toJSON(), esError: true };
    }
    console.error(`Fallo al ejecutar la tool "${nombre}":`, error);
    return {
      resultado: { error: { codigo: "ERROR_DESCONOCIDO", mensaje: "Fallo interno al ejecutar la herramienta." } },
      esError: true,
    };
  }
}
