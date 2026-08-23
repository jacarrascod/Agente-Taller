// Esquemas Zod compartidos por las tools del agente y los endpoints REST
// (SPEC.md §12): "un LLM puede alucinar un argumento y no debe llegar
// nunca crudo a la base de datos". Un solo esquema por operación, sin
// importar quién la invoque.

import { z } from "zod";

export const zBuscarRepuestos = z.object({
  consulta: z.string().min(1).max(200),
  modelo: z.string().max(60).optional(),
  anio: z.number().int().min(1990).max(2027).optional(),
  categoria: z
    .enum([
      "filtros",
      "frenos",
      "motor",
      "suspension",
      "electrico",
      "lubricantes",
      "transmision",
      "accesorios",
    ])
    .optional(),
  // DEF-16: encadenar `.default(5).optional()` hacía que Zod devolviera
  // `undefined` (el `.optional()` corta antes de aplicar el default), y el
  // servicio caía a su propio `?? 8`. El efecto: el default real nunca fue
  // 5 como documenta el SPEC §9.4 T1, sino 8. `.default()` ya vuelve el
  // campo opcional en la entrada — no hace falta encadenar `.optional()`.
  limite: z.number().int().min(1).max(10).default(5),
});

export const zConsultarDisponibilidadRepuesto = z.object({
  sku: z.string().min(3).max(40),
});

export const zConsultarDisponibilidadAgenda = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD"),
  fecha_hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD")
    .optional(),
});

export const zAgendarCita = z.object({
  inicio_iso: z.string().min(10),
  mantenimiento_slug: z.enum(["express-5k", "preventivo-20k", "mayor-40k"]),
  nombre_cliente: z.string().min(2).max(120),
  email: z.string().email(),
  telefono: z.coerce.string().min(6).max(20),
  modelo_vehiculo: z.string().min(2).max(60),
  anio_vehiculo: z.number().int().min(1990).max(2027).optional(),
  placa: z.string().max(12).optional(),
  notas: z.string().max(500).optional(),
});

export const zBuscarConocimiento = z.object({
  consulta: z.string().min(1).max(300),
  modelo: z.string().max(60).optional(),
});

export const zAgregarAlCarrito = z.object({
  sku: z.string().min(3).max(40),
  cantidad: z.number().int().min(1).max(20).default(1), // DEF-16 (misma corrección)
});

export const zConsultarCitas = z.object({
  email: z.string().email(),
  // Sin default aquí a propósito: la tool del agente y el endpoint REST
  // quieren defaults DISTINTOS cuando se omite (false vs. true — ver
  // agent/tools.ts y api/citas/route.ts), así que cada fachada resuelve
  // su propio valor con `??`. Un default único en el esquema no podría
  // servir a los dos a la vez (DEF-16).
  incluir_pasadas: z.boolean().optional(),
});

export const zCancelarCita = z.object({
  codigo: z.string().min(4).max(30),
  email: z.string().email(),
  motivo: z.string().max(300).optional(),
});

export const zCheckoutEntrega = z
  .object({
    modalidad: z.enum(["recojo", "delivery"]),
    direccion: z.string().max(200).optional(),
    distrito: z.string().max(60).optional(),
    referenciaEntrega: z.string().max(200).optional(),
  })
  .refine((v) => v.modalidad !== "delivery" || (!!v.direccion?.trim() && !!v.distrito?.trim()), {
    message: "La dirección y el distrito son obligatorios para delivery.",
    path: ["direccion"],
  });

export const zCheckoutCliente = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  telefono: z.coerce.string().min(6).max(20),
});

export const zCheckoutItem = z.object({
  sku: z.string().min(3).max(40),
  cantidad: z.number().int().min(1).max(20),
});

export const zCheckoutTarjeta = z.object({
  ultimos4: z.string().regex(/^\d{4}$/),
});

export const zCheckout = z.object({
  cliente: zCheckoutCliente,
  entrega: zCheckoutEntrega,
  items: z.array(zCheckoutItem).min(1),
  tarjeta: zCheckoutTarjeta,
});
