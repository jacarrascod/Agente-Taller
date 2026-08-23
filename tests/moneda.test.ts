import { describe, expect, it } from "vitest";
import {
  calcularCostoEnvio,
  calcularDesglosePedido,
  esCvvValido,
  esNumeroTarjetaValido,
  esVencimientoValido,
  formatearPEN,
} from "@/server/lib/moneda";
import {
  esCvvValido as esCvvValidoCliente,
  esNumeroTarjetaValido as esNumeroTarjetaValidoCliente,
  esVencimientoValido as esVencimientoValidoCliente,
  evaluarTarjetaDemo,
  generarReferenciaPagoDemo,
} from "@/lib/pago";

describe("formatearPEN", () => {
  it("formatea con separador de miles y dos decimales", () => {
    expect(formatearPEN(1234.5)).toBe("S/ 1,234.50");
    expect(formatearPEN(38)).toBe("S/ 38.00");
  });

  it("formatea cero", () => {
    expect(formatearPEN(0)).toBe("S/ 0.00");
  });

  it("formatea un millón con separadores de miles", () => {
    expect(formatearPEN(1000000)).toBe("S/ 1,000,000.00");
  });

  it("no produce NaN con un redondeo de submúltiplo de centavo", () => {
    expect(formatearPEN(0.005)).not.toContain("NaN");
  });
});

describe("calcularCostoEnvio — borde exacto de S/ 300", () => {
  it("cobra envío con S/ 299.99", () => {
    expect(calcularCostoEnvio("delivery", 299.99)).toBe(15);
  });

  it("no cobra envío con S/ 300.00 exactos", () => {
    expect(calcularCostoEnvio("delivery", 300)).toBe(0);
  });

  it("no cobra envío por encima de S/ 300", () => {
    expect(calcularCostoEnvio("delivery", 300.01)).toBe(0);
  });

  it("recojo en tienda siempre es gratis", () => {
    expect(calcularCostoEnvio("recojo", 0)).toBe(0);
    expect(calcularCostoEnvio("recojo", 50)).toBe(0);
    expect(calcularCostoEnvio("recojo", 500)).toBe(0);
  });
});

describe("calcularDesglosePedido", () => {
  it("con delivery y S/ 250 en ítems: envío S/ 15, total S/ 265", () => {
    const d = calcularDesglosePedido("delivery", 250);
    expect(d.costoEnvio).toBe(15);
    expect(d.total).toBe(265);
  });

  it("con delivery y S/ 320 en ítems: envío gratis, total S/ 320", () => {
    const d = calcularDesglosePedido("delivery", 320);
    expect(d.costoEnvio).toBe(0);
    expect(d.total).toBe(320);
  });

  it("subtotal + igv = total (IGV 18%)", () => {
    const d = calcularDesglosePedido("delivery", 250);
    expect(Math.round((d.subtotal + d.igv) * 100) / 100).toBe(d.total);
  });

  it("el IGV se calcula sobre el total (envío incluido), no solo sobre los ítems", () => {
    // Con recojo, total = montoItems, así que igv debe ser total - total/1.18.
    const d = calcularDesglosePedido("recojo", 118);
    expect(d.subtotal).toBeCloseTo(100, 2);
    expect(d.igv).toBeCloseTo(18, 2);
  });

  it("redondeo acumulado de varios ítems no desvía el total en centavos", () => {
    const montoItems = 33.33 * 3; // 99.99
    const d = calcularDesglosePedido("recojo", montoItems);
    expect(d.montoItems).toBe(99.99);
    expect(d.total).toBe(99.99);
  });
});

describe("esNumeroTarjetaValido (Luhn) — server", () => {
  it("acepta la tarjeta de prueba aprobada", () => {
    expect(esNumeroTarjetaValido("4111 1111 1111 1111")).toBe(true);
  });

  it("acepta las tarjetas de prueba rechazadas (son válidas por Luhn)", () => {
    expect(esNumeroTarjetaValido("4000000000000002")).toBe(true);
    expect(esNumeroTarjetaValido("4000000000000069")).toBe(true);
  });

  it("rechaza un número con dígito de control incorrecto", () => {
    expect(esNumeroTarjetaValido("4111 1111 1111 1112")).toBe(false);
  });

  it("rechaza longitudes inválidas", () => {
    expect(esNumeroTarjetaValido("411111")).toBe(false);
    expect(esNumeroTarjetaValido("4111111111111111111111")).toBe(false);
  });

  it("acepta con espacios y guiones mezclados", () => {
    expect(esNumeroTarjetaValido("4111 1111-1111 1111")).toBe(true);
  });

  it("rechaza letras y cadena vacía", () => {
    expect(esNumeroTarjetaValido("abcd efgh ijkl mnop")).toBe(false);
    expect(esNumeroTarjetaValido("")).toBe(false);
  });
});

describe("esVencimientoValido", () => {
  it("acepta una fecha futura", () => {
    expect(esVencimientoValido("12", "30")).toBe(true);
  });

  it("rechaza una fecha pasada", () => {
    expect(esVencimientoValido("01", "20")).toBe(false);
  });

  it("rechaza un mes fuera de rango", () => {
    expect(esVencimientoValido("13", "30")).toBe(false);
    expect(esVencimientoValido("00", "30")).toBe(false);
  });

  it("acepta el mes en curso del año en curso (vence al final del mes)", () => {
    const ahora = new Date("2026-08-15T12:00:00.000Z");
    expect(esVencimientoValido("08", "26", ahora)).toBe(true);
  });

  it("rechaza el mes anterior del año en curso", () => {
    const ahora = new Date("2026-08-15T12:00:00.000Z");
    expect(esVencimientoValido("07", "26", ahora)).toBe(false);
  });
});

describe("esCvvValido", () => {
  it("acepta 3 dígitos", () => {
    expect(esCvvValido("123")).toBe(true);
  });
  it("rechaza otras longitudes", () => {
    expect(esCvvValido("12")).toBe(false);
    expect(esCvvValido("12345")).toBe(false);
  });
  it("rechaza no numéricos", () => {
    expect(esCvvValido("abc")).toBe(false);
    expect(esCvvValido("")).toBe(false);
  });
});

// UT-MON-22 / DEF-06: src/lib/pago.ts (cliente) y src/server/lib/moneda.ts
// (servidor) implementan la misma lógica de Luhn/vencimiento/CVV por
// separado. Solo la del cliente está realmente en uso (ver checkout/page.tsx);
// la del servidor es código muerto duplicado. Esta prueba de paridad es la
// red de seguridad: si algún día divergen, esto falla antes que un cliente
// lo note.
describe("UT-MON-22 — paridad entre lib/pago.ts (cliente) y server/lib/moneda.ts", () => {
  const numeros = [
    "4111111111111111",
    "4000000000000002",
    "4000000000000069",
    "4111111111111112", // Luhn inválido
    "411111", // muy corto
    "4111 1111 1111 1111", // con espacios
  ];

  it.each(numeros)("Luhn coincide para %s", (numero) => {
    expect(esNumeroTarjetaValidoCliente(numero)).toBe(esNumeroTarjetaValido(numero));
  });

  it("vencimiento coincide", () => {
    expect(esVencimientoValidoCliente("12", "30")).toBe(esVencimientoValido("12", "30"));
    expect(esVencimientoValidoCliente("01", "20")).toBe(esVencimientoValido("01", "20"));
  });

  it("CVV coincide", () => {
    expect(esCvvValidoCliente("123")).toBe(esCvvValido("123"));
    expect(esCvvValidoCliente("12")).toBe(esCvvValido("12"));
  });
});

describe("evaluarTarjetaDemo (§14 — las 3 tarjetas de prueba)", () => {
  it("aprueba 4111 1111 1111 1111", () => {
    expect(evaluarTarjetaDemo("4111111111111111")).toEqual({ aprobado: true });
  });

  it("rechaza 4000 0000 0000 0002 por fondos insuficientes", () => {
    const r = evaluarTarjetaDemo("4000000000000002");
    expect(r.aprobado).toBe(false);
    if (!r.aprobado) expect(r.motivo).toMatch(/fondos/i);
  });

  it("rechaza 4000 0000 0000 0069 por tarjeta vencida", () => {
    const r = evaluarTarjetaDemo("4000000000000069");
    expect(r.aprobado).toBe(false);
    if (!r.aprobado) expect(r.motivo).toMatch(/vencida/i);
  });

  it("aprueba cualquier otro número válido por Luhn", () => {
    expect(evaluarTarjetaDemo("4012888888881881")).toEqual({ aprobado: true });
  });
});

describe("generarReferenciaPagoDemo", () => {
  it("tiene el formato DEMO-TXN-XXXXXXXX", () => {
    expect(generarReferenciaPagoDemo()).toMatch(/^DEMO-TXN-[0-9A-F]{8}$/);
  });

  it("no colisiona en 500 generaciones consecutivas", () => {
    const referencias = new Set(Array.from({ length: 500 }, () => generarReferenciaPagoDemo()));
    expect(referencias.size).toBe(500);
  });
});
