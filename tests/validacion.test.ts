import { describe, expect, it } from "vitest";
import {
  zAgendarCita,
  zBuscarRepuestos,
  zCancelarCita,
  zCheckout,
  zCheckoutEntrega,
  zCheckoutTarjeta,
  zConsultarCitas,
  zConsultarDisponibilidadAgenda,
} from "@/server/lib/validacion";

describe("zBuscarRepuestos", () => {
  it("rechaza consulta vacía", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "" }).success).toBe(false);
  });

  it("rechaza consulta de más de 200 caracteres", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "a".repeat(201) }).success).toBe(false);
  });

  it("rechaza año fuera de rango", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "filtro", anio: 1989 }).success).toBe(false);
    expect(zBuscarRepuestos.safeParse({ consulta: "filtro", anio: 2028 }).success).toBe(false);
  });

  it("acepta los bordes del rango de año", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "filtro", anio: 1990 }).success).toBe(true);
    expect(zBuscarRepuestos.safeParse({ consulta: "filtro", anio: 2027 }).success).toBe(true);
  });

  it("rechaza año no entero", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "filtro", anio: 2018.5 }).success).toBe(false);
  });

  it("rechaza una categoría fuera del enum cerrado de 8", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "x", categoria: "carroceria" }).success).toBe(false);
  });

  it("límite: rechaza 0 y 11, acepta 10, y por defecto es 5", () => {
    expect(zBuscarRepuestos.safeParse({ consulta: "x", limite: 0 }).success).toBe(false);
    expect(zBuscarRepuestos.safeParse({ consulta: "x", limite: 11 }).success).toBe(false);
    expect(zBuscarRepuestos.safeParse({ consulta: "x", limite: 10 }).success).toBe(true);
    const r = zBuscarRepuestos.safeParse({ consulta: "x" });
    expect(r.success && r.data.limite).toBe(5);
  });

  it("una propiedad extra alucinada por el LLM se descarta (strip), no llega cruda", () => {
    const r = zBuscarRepuestos.safeParse({ consulta: "x", sql: "DROP TABLE repuestos" });
    expect(r.success).toBe(true);
    expect(r.success && (r.data as Record<string, unknown>).sql).toBeUndefined();
  });
});

describe("zAgendarCita", () => {
  it("rechaza un mantenimiento_slug fuera del enum de 3", () => {
    const base = validAgendarCitaArgs();
    expect(
      zAgendarCita.safeParse({ ...base, mantenimiento_slug: "express-10k" }).success,
    ).toBe(false);
  });

  it("rechaza emails con formato inválido", () => {
    const base = validAgendarCitaArgs();
    expect(zAgendarCita.safeParse({ ...base, email: "ana@" }).success).toBe(false);
    expect(zAgendarCita.safeParse({ ...base, email: "ana ejemplo.com" }).success).toBe(false);
    expect(zAgendarCita.safeParse({ ...base, email: "" }).success).toBe(false);
  });

  it("rechaza teléfono muy corto o muy largo", () => {
    const base = validAgendarCitaArgs();
    expect(zAgendarCita.safeParse({ ...base, telefono: "12345" }).success).toBe(false);
    expect(zAgendarCita.safeParse({ ...base, telefono: "1".repeat(21) }).success).toBe(false);
  });

  it("acepta un inicio_iso de 10+ caracteres aunque no sea una fecha real (la valida el servicio, no Zod)", () => {
    const base = validAgendarCitaArgs();
    expect(zAgendarCita.safeParse({ ...base, inicio_iso: "mañana a las 10" }).success).toBe(true);
  });

  function validAgendarCitaArgs() {
    return {
      inicio_iso: "2026-08-25T09:00:00-05:00",
      mantenimiento_slug: "express-5k",
      nombre_cliente: "Ana Quispe",
      email: "ana@ejemplo.com",
      telefono: "987654321",
      modelo_vehiculo: "Corolla",
    };
  }
});

describe("zConsultarDisponibilidadAgenda", () => {
  it("rechaza formatos de fecha no YYYY-MM-DD", () => {
    expect(zConsultarDisponibilidadAgenda.safeParse({ fecha: "25-08-2026" }).success).toBe(false);
    expect(zConsultarDisponibilidadAgenda.safeParse({ fecha: "2026-8-5" }).success).toBe(false);
  });

  it("acepta sintácticamente una fecha imposible (2026-13-45) — el servicio debe manejarla", () => {
    // El regex solo exige el formato de dígitos, no que sea una fecha real.
    expect(zConsultarDisponibilidadAgenda.safeParse({ fecha: "2026-13-45" }).success).toBe(true);
  });

  it("rechaza fecha ausente", () => {
    expect(zConsultarDisponibilidadAgenda.safeParse({}).success).toBe(false);
  });
});

describe("zConsultarCitas", () => {
  it("rechaza incluir_pasadas como string en vez de boolean (no coacciona tipos)", () => {
    expect(
      zConsultarCitas.safeParse({ email: "ana@ejemplo.com", incluir_pasadas: "true" }).success,
    ).toBe(false);
  });

  it("acepta sin incluir_pasadas (usa el default)", () => {
    const r = zConsultarCitas.safeParse({ email: "ana@ejemplo.com" });
    expect(r.success).toBe(true);
  });
});

describe("zCancelarCita", () => {
  it("rechaza código demasiado corto o demasiado largo", () => {
    expect(zCancelarCita.safeParse({ codigo: "abc", email: "a@b.com" }).success).toBe(false);
    expect(zCancelarCita.safeParse({ codigo: "a".repeat(31), email: "a@b.com" }).success).toBe(false);
  });

  it("acepta el formato real de código de cita", () => {
    expect(zCancelarCita.safeParse({ codigo: "CITA-2026-0007", email: "a@b.com" }).success).toBe(true);
  });
});

describe("zCheckoutTarjeta", () => {
  it("solo acepta exactamente 4 dígitos en ultimos4", () => {
    expect(zCheckoutTarjeta.safeParse({ ultimos4: "111" }).success).toBe(false);
    expect(zCheckoutTarjeta.safeParse({ ultimos4: "11111" }).success).toBe(false);
    expect(zCheckoutTarjeta.safeParse({ ultimos4: "11a1" }).success).toBe(false);
    expect(zCheckoutTarjeta.safeParse({ ultimos4: "1111" }).success).toBe(true);
  });
});

describe("zCheckoutEntrega — DEF-04 corregido: delivery exige dirección Y distrito", () => {
  it("recojo no exige dirección ni distrito", () => {
    expect(zCheckoutEntrega.safeParse({ modalidad: "recojo" }).success).toBe(true);
  });

  it("delivery SIN dirección ni distrito se rechaza (antes pasaba)", () => {
    expect(zCheckoutEntrega.safeParse({ modalidad: "delivery" }).success).toBe(false);
  });

  it("delivery con dirección pero sin distrito se rechaza", () => {
    expect(
      zCheckoutEntrega.safeParse({ modalidad: "delivery", direccion: "Av. Larco 123" }).success,
    ).toBe(false);
  });

  it("delivery con distrito pero sin dirección se rechaza", () => {
    expect(zCheckoutEntrega.safeParse({ modalidad: "delivery", distrito: "Surco" }).success).toBe(
      false,
    );
  });

  it("delivery con dirección y distrito (no vacíos) se acepta", () => {
    expect(
      zCheckoutEntrega.safeParse({ modalidad: "delivery", direccion: "Av. Larco 123", distrito: "Miraflores" })
        .success,
    ).toBe(true);
  });

  it("delivery con dirección de solo espacios se rechaza", () => {
    expect(
      zCheckoutEntrega.safeParse({ modalidad: "delivery", direccion: "   ", distrito: "Surco" }).success,
    ).toBe(false);
  });
});

describe("zCheckout", () => {
  function base() {
    return {
      cliente: { nombre: "Ana Quispe", email: "ana@ejemplo.com", telefono: "987654321" },
      entrega: { modalidad: "recojo" as const },
      items: [{ sku: "TOY-FIL-0001", cantidad: 1 }],
      tarjeta: { ultimos4: "1111" },
    };
  }

  it("rechaza carrito vacío", () => {
    expect(zCheckout.safeParse({ ...base(), items: [] }).success).toBe(false);
  });

  it("rechaza cantidad 0 y cantidad 21", () => {
    expect(
      zCheckout.safeParse({ ...base(), items: [{ sku: "TOY-FIL-0001", cantidad: 0 }] }).success,
    ).toBe(false);
    expect(
      zCheckout.safeParse({ ...base(), items: [{ sku: "TOY-FIL-0001", cantidad: 21 }] }).success,
    ).toBe(false);
  });

  it("acepta cantidad 20 (borde superior)", () => {
    expect(
      zCheckout.safeParse({ ...base(), items: [{ sku: "TOY-FIL-0001", cantidad: 20 }] }).success,
    ).toBe(true);
  });

  it("un checkout válido con recojo pasa completo", () => {
    expect(zCheckout.safeParse(base()).success).toBe(true);
  });

  it("un checkout de delivery sin dirección falla en el nivel raíz (no solo en el sub-esquema)", () => {
    const r = zCheckout.safeParse({ ...base(), entrega: { modalidad: "delivery" } });
    expect(r.success).toBe(false);
  });
});
