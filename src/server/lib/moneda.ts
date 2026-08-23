// Formato de moneda y cálculo de IGV/envío (SPEC.md §3, §14).
// Los precios de catálogo YA incluyen IGV; el desglose se calcula al emitir
// el pedido: subtotal = total / 1.18, igv = total - subtotal.

import { negocio } from "./taller";

/** "S/ 1,234.56" — formato de referencia usado en todo el producto. */
export function formatearPEN(monto: number): string {
  const formateado = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
  return `S/ ${formateado}`;
}

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Costo de envío para delivery en Lima: gratis desde `envioGratisDesde`. */
export function calcularCostoEnvio(modalidad: "recojo" | "delivery", montoItems: number): number {
  if (modalidad === "recojo") return 0;
  return montoItems >= negocio.envioGratisDesde ? 0 : negocio.envioCostoLima;
}

export interface DesglosePedido {
  montoItems: number;
  costoEnvio: number;
  total: number;
  subtotal: number;
  igv: number;
}

/** Desglose completo de un pedido a partir del monto de ítems (IGV incluido). */
export function calcularDesglosePedido(
  modalidad: "recojo" | "delivery",
  montoItems: number,
): DesglosePedido {
  const costoEnvio = calcularCostoEnvio(modalidad, montoItems);
  const total = redondear2(montoItems + costoEnvio);
  const subtotal = redondear2(total / (1 + negocio.igvPorcentaje / 100));
  const igv = redondear2(total - subtotal);
  return { montoItems: redondear2(montoItems), costoEnvio, total, subtotal, igv };
}

/** Algoritmo de Luhn — validación de número de tarjeta (nunca se envía al servidor). */
export function esNumeroTarjetaValido(numero: string): boolean {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let doblar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (doblar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doblar = !doblar;
  }
  return suma % 10 === 0;
}

/** Vencimiento MM/AA en el futuro (o mes actual inclusive). */
export function esVencimientoValido(mm: string, aa: string, ahora: Date = new Date()): boolean {
  const mes = Number(mm);
  const anio = Number(aa);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
  if (!Number.isInteger(anio)) return false;
  const anioCompleto = anio < 100 ? 2000 + anio : anio;
  const finDeMes = Date.UTC(anioCompleto, mes, 1); // primer día del mes siguiente
  return finDeMes > ahora.getTime();

}

export function esCvvValido(cvv: string): boolean {
  return /^\d{3}$/.test(cvv);
}
