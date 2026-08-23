// Descuento de stock transaccional (SPEC.md §6.3, §14).
// `descontar_stock` en SQL usa UPDATE ... WHERE stock >= cantidad, nunca
// lectura-luego-escritura, para que la sobreventa sea imposible en carrera.

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";
import { ErrorAplicacion } from "../lib/errores";

export async function descontarStock(repuestoId: string, cantidad: number): Promise<number> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("descontar_stock", {
    p_repuesto_id: repuestoId,
    p_cantidad: cantidad,
  });
  if (error) {
    if (error.message.includes("STOCK_INSUFICIENTE")) {
      throw new ErrorAplicacion("STOCK_INSUFICIENTE", `Stock insuficiente para el repuesto ${repuestoId}.`, 409, {
        repuestoId,
      });
    }
    throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al descontar stock: ${error.message}`, 500);
  }
  return data as number;
}

/**
 * Compensación para el checkout: si un pedido con varios ítems falla a
 * mitad de camino (uno sin stock), se revierte el descuento ya aplicado a
 * los ítems anteriores. Es una acción de reversión sobre un camino de
 * error, no la venta principal — esa siempre pasa por `descontarStock`,
 * que es atómica.
 */
export async function revertirStock(repuestoId: string, cantidad: number): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("inventario").select("stock").eq("repuesto_id", repuestoId).single();
  if (error) {
    console.error(`No se pudo leer el stock de ${repuestoId} para revertir:`, error);
    return;
  }
  await db
    .from("inventario")
    .update({ stock: data.stock + cantidad, actualizado_en: new Date().toISOString() })
    .eq("repuesto_id", repuestoId);
}
