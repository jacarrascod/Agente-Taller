// Checkout dummy (SPEC.md §14). Nunca se procesa un pago real. El número
// completo de tarjeta, el CVV y el vencimiento se validan en el cliente
// (algoritmo de Luhn + tabla de tarjetas de prueba) y NUNCA llegan al
// servidor: solo se transmiten los últimos 4 dígitos.

import "server-only";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "../integrations/supabase";
import { descontarStock, revertirStock } from "./inventario";
import { calcularDesglosePedido } from "../lib/moneda";
import { ErrorAplicacion } from "../lib/errores";
import { enviarCorreoTransaccional } from "../email/enviar";
import { plantillaPedidoConfirmado } from "../email/plantillas/pedido-confirmado";
import type { ItemCarrito, ModalidadEntrega, Pedido, PedidoItem } from "@/types/dominio";

export interface DatosCliente {
  nombre: string;
  email: string;
  telefono: string;
}

export interface DatosEntrega {
  modalidad: ModalidadEntrega;
  direccion?: string;
  distrito?: string;
  referenciaEntrega?: string;
}

function generarReferenciaPago(): string {
  return `DEMO-TXN-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type PedidoConEstadoEnvio = Pedido & { emailEnviado: boolean };

export async function crearPedido(
  cliente: DatosCliente,
  entrega: DatosEntrega,
  items: ItemCarrito[],
  ultimos4: string,
): Promise<PedidoConEstadoEnvio> {
  if (items.length === 0) {
    throw new ErrorAplicacion("REPUESTO_NO_ENCONTRADO", "El carrito está vacío.", 400);
  }
  if (entrega.modalidad === "delivery" && (!entrega.direccion || !entrega.direccion.trim())) {
    throw new ErrorAplicacion("DATOS_INVALIDOS", "La dirección es obligatoria para delivery.", 400);
  }

  const db = supabaseAdmin();
  const skus = items.map((i) => i.sku);
  const { data: repuestos, error: errorRepuestos } = await db
    .from("repuestos")
    .select("id, sku, nombre, precio")
    .in("sku", skus)
    .eq("activo", true);

  if (errorRepuestos) {
    throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al leer repuestos: ${errorRepuestos.message}`, 500);
  }

  const repuestoPorSku = new Map((repuestos ?? []).map((r) => [r.sku, r]));
  const faltantes = skus.filter((s) => !repuestoPorSku.has(s));
  if (faltantes.length > 0) {
    throw new ErrorAplicacion("REPUESTO_NO_ENCONTRADO", `No se encontró: ${faltantes.join(", ")}`, 404, {
      skus: faltantes,
    });
  }

  const itemsPedido: (PedidoItem & { repuestoId: string })[] = items.map((item) => {
    const r = repuestoPorSku.get(item.sku)!;
    const precioUnitario = Number(r.precio);
    return {
      sku: r.sku,
      nombre: r.nombre,
      precio_unitario: precioUnitario,
      cantidad: item.cantidad,
      subtotal: Math.round(precioUnitario * item.cantidad * 100) / 100,
      repuestoId: r.id,
    };
  });

  const montoItems = itemsPedido.reduce((acc, i) => acc + i.subtotal, 0);
  const desglose = calcularDesglosePedido(entrega.modalidad, montoItems);

  // Descuento de stock ítem por ítem. Si uno falla, se revierte lo ya
  // descontado y se cancela todo el pedido (SPEC.md §14).
  const descontados: { repuestoId: string; cantidad: number }[] = [];
  try {
    for (const item of itemsPedido) {
      await descontarStock(item.repuestoId, item.cantidad);
      descontados.push({ repuestoId: item.repuestoId, cantidad: item.cantidad });
    }
  } catch (error) {
    for (const d of descontados.reverse()) {
      await revertirStock(d.repuestoId, d.cantidad);
    }
    if (error instanceof ErrorAplicacion) throw error;
    throw new ErrorAplicacion("STOCK_INSUFICIENTE", "No se pudo completar el pedido por falta de stock.", 409);
  }

  const referenciaPago = generarReferenciaPago();

  const { data: pedidoInsertado, error: errorPedido } = await db
    .from("pedidos")
    .insert({
      nombre_cliente: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
      modalidad_entrega: entrega.modalidad,
      direccion: entrega.direccion ?? null,
      distrito: entrega.distrito ?? null,
      referencia_entrega: entrega.referenciaEntrega ?? null,
      monto_items: desglose.montoItems,
      costo_envio: desglose.costoEnvio,
      subtotal: desglose.subtotal,
      igv: desglose.igv,
      total: desglose.total,
      estado: "pagado",
      metodo_pago: "tarjeta_demo",
      referencia_pago: referenciaPago,
      ultimos4,
    })
    .select("*")
    .single();

  if (errorPedido || !pedidoInsertado) {
    for (const d of descontados.reverse()) {
      await revertirStock(d.repuestoId, d.cantidad);
    }
    throw new ErrorAplicacion(
      "ERROR_DESCONOCIDO",
      `No se pudo registrar el pedido: ${errorPedido?.message ?? "desconocido"}`,
      500,
    );
  }

  const { error: errorItems } = await db.from("pedido_items").insert(
    itemsPedido.map((i) => ({
      pedido_id: pedidoInsertado.id,
      repuesto_id: i.repuestoId,
      sku: i.sku,
      nombre: i.nombre,
      precio_unitario: i.precio_unitario,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
    })),
  );
  if (errorItems) {
    // DEF-08: sin esto, quedaba un pedido en estado 'pagado' sin ítems y con
    // el stock ya descontado, mientras el cliente veía una confirmación de
    // éxito. Se anula el pedido (se conserva como historial de la falla, no
    // se borra) y se revierte el stock — el mismo patrón de reversión que
    // ya se usa arriba para el fallo de stock insuficiente.
    console.error(`No se pudieron registrar los ítems del pedido ${pedidoInsertado.codigo}:`, errorItems);
    await db.from("pedidos").update({ estado: "anulado" }).eq("id", pedidoInsertado.id);
    for (const d of descontados.reverse()) {
      await revertirStock(d.repuestoId, d.cantidad);
    }
    throw new ErrorAplicacion(
      "ERROR_DESCONOCIDO",
      `No se pudo registrar el pedido: ${errorItems.message}`,
      500,
    );
  }

  let emailEnviado = false;
  try {
    const plantilla = plantillaPedidoConfirmado({
      codigo: pedidoInsertado.codigo,
      nombreCliente: cliente.nombre,
      items: itemsPedido,
      montoItems: desglose.montoItems,
      costoEnvio: desglose.costoEnvio,
      subtotal: desglose.subtotal,
      igv: desglose.igv,
      total: desglose.total,
      modalidadEntrega: entrega.modalidad,
      direccion: entrega.direccion,
      distrito: entrega.distrito,
      referenciaEntrega: entrega.referenciaEntrega,
    });
    const resultadoEnvio = await enviarCorreoTransaccional({
      tipo: "pedido_confirmado",
      referencia: pedidoInsertado.codigo,
      destinatario: { email: cliente.email, nombre: cliente.nombre },
      asunto: plantilla.asunto,
      htmlContent: plantilla.htmlContent,
      textContent: plantilla.textContent,
    });
    emailEnviado = resultadoEnvio.enviado;
  } catch (error) {
    console.error(`No se pudo enviar el correo del pedido ${pedidoInsertado.codigo}:`, error);
  }

  return {
    emailEnviado,
    id: pedidoInsertado.id,
    codigo: pedidoInsertado.codigo,
    nombre_cliente: pedidoInsertado.nombre_cliente,
    email: pedidoInsertado.email,
    telefono: pedidoInsertado.telefono,
    modalidad_entrega: pedidoInsertado.modalidad_entrega,
    direccion: pedidoInsertado.direccion,
    distrito: pedidoInsertado.distrito,
    ciudad: pedidoInsertado.ciudad ?? "Lima",
    referencia_entrega: pedidoInsertado.referencia_entrega,
    monto_items: Number(pedidoInsertado.monto_items),
    costo_envio: Number(pedidoInsertado.costo_envio),
    subtotal: Number(pedidoInsertado.subtotal),
    igv: Number(pedidoInsertado.igv),
    total: Number(pedidoInsertado.total),
    estado: pedidoInsertado.estado,
    metodo_pago: pedidoInsertado.metodo_pago,
    referencia_pago: pedidoInsertado.referencia_pago,
    ultimos4: pedidoInsertado.ultimos4,
    creado_en: pedidoInsertado.creado_en,
    items: itemsPedido.map((i) => ({
      sku: i.sku,
      nombre: i.nombre,
      precio_unitario: i.precio_unitario,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
    })),
  };
}

export async function obtenerPedidoPorCodigo(codigo: string): Promise<Pedido | null> {
  const db = supabaseAdmin();
  const { data: pedido, error } = await db.from("pedidos").select("*").eq("codigo", codigo).maybeSingle();
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al obtener el pedido: ${error.message}`, 500);
  if (!pedido) return null;

  const { data: items } = await db
    .from("pedido_items")
    .select("sku, nombre, precio_unitario, cantidad, subtotal")
    .eq("pedido_id", pedido.id);

  return {
    id: pedido.id,
    codigo: pedido.codigo,
    nombre_cliente: pedido.nombre_cliente,
    email: pedido.email,
    telefono: pedido.telefono,
    modalidad_entrega: pedido.modalidad_entrega,
    direccion: pedido.direccion,
    distrito: pedido.distrito,
    ciudad: pedido.ciudad ?? "Lima",
    referencia_entrega: pedido.referencia_entrega,
    monto_items: Number(pedido.monto_items),
    costo_envio: Number(pedido.costo_envio),
    subtotal: Number(pedido.subtotal),
    igv: Number(pedido.igv),
    total: Number(pedido.total),
    estado: pedido.estado,
    metodo_pago: pedido.metodo_pago,
    referencia_pago: pedido.referencia_pago,
    ultimos4: pedido.ultimos4,
    creado_en: pedido.creado_en,
    items: (items ?? []).map((i) => ({
      sku: i.sku,
      nombre: i.nombre,
      precio_unitario: Number(i.precio_unitario),
      cantidad: i.cantidad,
      subtotal: Number(i.subtotal),
    })),
  };
}
