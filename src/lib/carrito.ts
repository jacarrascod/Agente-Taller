// Carrito en localStorage (SPEC.md S5: "se pierde al limpiar el navegador").
// Solo se usa desde componentes cliente.

import type { ItemCarrito } from "@/types/dominio";

const CLAVE_CARRITO = "ttp_carrito";
const EVENTO_CAMBIO = "ttp:carrito-cambio";

export function leerCarrito(): ItemCarrito[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(CLAVE_CARRITO);
    if (!crudo) return [];
    const items = JSON.parse(crudo);
    if (!Array.isArray(items)) return [];
    return items;
  } catch {
    return [];
  }
}

function guardarCarrito(items: ItemCarrito[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENTO_CAMBIO));
}

export function agregarAlCarrito(sku: string, cantidad = 1): ItemCarrito[] {
  const items = leerCarrito();
  const existente = items.find((i) => i.sku === sku);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    items.push({ sku, cantidad });
  }
  guardarCarrito(items);
  return items;
}

export function actualizarCantidad(sku: string, cantidad: number): ItemCarrito[] {
  let items = leerCarrito();
  if (cantidad <= 0) {
    items = items.filter((i) => i.sku !== sku);
  } else {
    const existente = items.find((i) => i.sku === sku);
    if (existente) existente.cantidad = cantidad;
  }
  guardarCarrito(items);
  return items;
}

export function quitarDelCarrito(sku: string): ItemCarrito[] {
  const items = leerCarrito().filter((i) => i.sku !== sku);
  guardarCarrito(items);
  return items;
}

export function vaciarCarrito(): void {
  guardarCarrito([]);
}

export function totalItemsCarrito(items: ItemCarrito[]): number {
  return items.reduce((acc, i) => acc + i.cantidad, 0);
}

export function suscribirCambiosCarrito(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_CAMBIO, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, callback);
    window.removeEventListener("storage", callback);
  };
}
