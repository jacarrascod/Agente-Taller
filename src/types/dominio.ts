// Tipos de dominio compartidos entre servicios, tools del agente y API REST.
// Ver SPEC.md §6 (modelo de datos) y §9.4 (contratos de las tools).

export type EstadoStock = "disponible" | "ultimas_unidades" | "agotado";

export interface Categoria {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  orden: number;
}

export interface ModeloToyota {
  id: number;
  slug: string;
  nombre: string;
  carroceria: string | null;
  anio_desde: number;
  anio_hasta: number | null;
}

export interface RepuestoBusqueda {
  id: string;
  sku: string;
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  imagen_url: string;
  stock_disponible: number;
  estado_stock: EstadoStock;
  compatibilidad: string[];
  relevancia: number;
}

export interface RepuestoFicha {
  id: string;
  sku: string;
  slug: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  categoria_slug: string;
  numero_parte: string | null;
  marca_repuesto: string;
  precio: number;
  moneda: string;
  imagen_url: string;
  garantia_meses: number;
  especificaciones: Record<string, unknown>;
  destacado: boolean;
  stock_disponible: number;
  estado_stock: EstadoStock;
  dias_reposicion: number;
  ubicacion_publica: string | null;
  compatibilidad: { modelo: string; anio_desde: number | null; anio_hasta: number | null }[];
}

export interface Mantenimiento {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  duracion_minutos: number;
  precio: number;
  intervalo_km: number | null;
  incluye: string[];
  imagen_url: string | null;
  orden: number;
}

export type EstadoCita = "confirmada" | "cancelada" | "atendida" | "no_asistio";
export type OrigenCita = "chat" | "web";

export interface Cita {
  id: string;
  codigo: string;
  nombre_cliente: string;
  email: string;
  telefono: string;
  modelo_vehiculo: string;
  anio_vehiculo: number | null;
  placa: string | null;
  mantenimiento_id: number;
  inicio: string; // ISO 8601
  fin: string; // ISO 8601
  estado: EstadoCita;
  google_event_id: string | null;
  notas: string | null;
  origen: OrigenCita;
  creado_en: string;
  cancelada_en: string | null;
  motivo_cancelacion: string | null;
}

export interface CitaResumen {
  codigo: string;
  estado: EstadoCita;
  inicio: string;
  servicio: string;
  precio: number;
  duracion_minutos: number;
  modelo_vehiculo: string;
  placa: string | null;
  es_futura: boolean;
}

/**
 * Forma de presentación de una cita (SPEC.md §9.4 T8): fecha/hora ya
 * formateadas en español. Es la forma que devuelven tanto la tool
 * `consultar_citas` como `GET /api/citas` — misma fachada, mismo esquema
 * (SPEC.md §4, "nunca se duplica lógica"). El chat y `/mis-citas` la
 * consumen directamente en vez de re-derivar fecha/hora desde `inicio`.
 */
export interface CitaFormateada {
  codigo: string;
  estado: EstadoCita;
  fecha_legible: string;
  hora: string;
  servicio: string;
  precio: number;
  vehiculo: string;
  es_futura: boolean;
  cancelable: boolean;
}

export interface RespuestaConsultaCitas {
  encontradas: number;
  citas: CitaFormateada[];
  sugerencia_al_agente: string | null;
}

export interface SlotAgenda {
  hora: string; // HH:mm
  iso: string; // ISO 8601 con offset -05:00
  libre: boolean;
}

export interface DiaAgenda {
  fecha: string; // YYYY-MM-DD
  dia_semana: string;
  laborable: boolean;
  slots: SlotAgenda[];
  total_libres: number;
  motivo?: string;
  siguiente_habil?: string;
}

export interface RespuestaDisponibilidad {
  dias: DiaAgenda[];
  mensaje: string | null;
}

export type ModalidadEntrega = "recojo" | "delivery";
export type EstadoPedido = "pendiente" | "pagado" | "rechazado" | "anulado";

export interface ItemCarrito {
  sku: string;
  cantidad: number;
}

export interface PedidoItem {
  sku: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  codigo: string;
  nombre_cliente: string;
  email: string;
  telefono: string;
  modalidad_entrega: ModalidadEntrega;
  direccion: string | null;
  distrito: string | null;
  ciudad: string;
  referencia_entrega: string | null;
  monto_items: number;
  costo_envio: number;
  subtotal: number;
  igv: number;
  total: number;
  estado: EstadoPedido;
  metodo_pago: string;
  referencia_pago: string | null;
  ultimos4: string | null;
  creado_en: string;
  items: PedidoItem[];
}

export interface FaqToyota {
  id: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
  relevancia: number;
}

export interface ErrorDominio {
  codigo:
    | "SLOT_OCUPADO"
    | "FUERA_DE_HORARIO"
    | "STOCK_INSUFICIENTE"
    | "REPUESTO_NO_ENCONTRADO"
    | "TARJETA_RECHAZADA"
    | "LIMITE_EXCEDIDO"
    | "LLM_NO_DISPONIBLE"
    | "CITA_NO_CANCELABLE"
    | "CITA_YA_PASADA"
    | "EMAIL_INVALIDO"
    | "DATOS_INVALIDOS"
    | "ERROR_DESCONOCIDO";
  mensaje: string;
  detalle?: unknown;
}
