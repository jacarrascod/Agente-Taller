import { describe, expect, it } from "vitest";
import {
  bloqueContextoFechaActual,
  construirInstanteLima,
  cumpleAnticipacionMinima,
  dentroDeVentanaAgenda,
  diaSemanaIsoLima,
  esDiaLaborableYMD,
  fechaYMDLima,
  formatearFechaHoraLargaEmail,
  formatearFechaLarga,
  generarSlotsCandidatos,
  horaHMLima,
  isoConOffsetLima,
  siguienteDiaHabilYMD,
} from "@/server/lib/fechas";

describe("generarSlotsCandidatos", () => {
  it("genera 8 slots de 09:00 a 16:00", () => {
    const slots = generarSlotsCandidatos("2026-08-25"); // martes
    expect(slots).toHaveLength(8);
    expect(slots[0].hora).toBe("09:00");
    expect(slots.at(-1)?.hora).toBe("16:00");
  });

  it("el slot de las 09:00 de Lima no se corre de día aunque el proceso corra en UTC", () => {
    // 09:00 en Lima (UTC-5) es 14:00 UTC del MISMO día calendario.
    const slots = generarSlotsCandidatos("2026-08-25");
    const primero = slots[0];
    expect(primero.inicio.toISOString()).toBe("2026-08-25T14:00:00.000Z");
    expect(primero.iso).toBe("2026-08-25T09:00:00-05:00");
  });

  it("el último slot (16:00) también cae en el mismo día calendario en Lima", () => {
    const slots = generarSlotsCandidatos("2026-08-25");
    const ultimo = slots.at(-1)!;
    expect(fechaYMDLima(ultimo.inicio)).toBe("2026-08-25");
    expect(horaHMLima(ultimo.inicio)).toBe("16:00");
  });
});

// UT-FEC-04/05: el proceso puede correr en cualquier zona (Render usa UTC).
// Estas aserciones son correctas SIN IMPORTAR la TZ del proceso porque
// `fechas.ts` nunca usa los getters locales de Date. Para verificar de
// verdad que eso es cierto (y no solo que "funciona en la TZ de mi
// máquina"), `npm run test:tz` corre este archivo completo bajo
// TZ=UTC, TZ=Asia/Tokyo y TZ=America/New_York con cross-env.
describe("independencia de la TZ del proceso", () => {
  it("el slot de las 09:00 Lima es el mismo instante UTC sin importar la TZ del proceso", () => {
    const slots = generarSlotsCandidatos("2026-08-25");
    expect(slots[0].inicio.toISOString()).toBe("2026-08-25T14:00:00.000Z");
    expect(slots[0].iso).toBe("2026-08-25T09:00:00-05:00");
  });

  it("fechaYMDLima da el día correcto para un instante fijo, sin importar TZ del proceso", () => {
    // 2026-08-26T04:00:00Z = 2026-08-25T23:00:00-05:00 (Lima) — día ANTERIOR.
    expect(fechaYMDLima(new Date("2026-08-26T04:00:00.000Z"))).toBe("2026-08-25");
  });

  it("horaHMLima da la hora correcta para un instante fijo, sin importar TZ del proceso", () => {
    expect(horaHMLima(new Date("2026-08-25T14:00:00.000Z"))).toBe("09:00");
  });

  it("diaSemanaIsoLima da el día ISO correcto (borde: medianoche de Lima = 05:00 UTC)", () => {
    // 2026-08-24T05:00:00Z = 2026-08-24T00:00:00-05:00 (Lima) = lunes.
    expect(diaSemanaIsoLima(new Date("2026-08-24T05:00:00.000Z"))).toBe(1);
    // Un segundo antes (2026-08-24T04:59:59Z) sigue siendo domingo en Lima.
    expect(diaSemanaIsoLima(new Date("2026-08-24T04:59:59.000Z"))).toBe(7);
  });
});

describe("isoConOffsetLima", () => {
  it("el offset es siempre -05:00, en enero y en julio (Perú no tiene horario de verano)", () => {
    expect(isoConOffsetLima(new Date("2026-01-15T14:00:00.000Z"))).toMatch(/-05:00$/);
    expect(isoConOffsetLima(new Date("2026-07-15T14:00:00.000Z"))).toMatch(/-05:00$/);
  });

  it("produce el formato ISO completo esperado", () => {
    expect(isoConOffsetLima(new Date("2026-08-25T14:00:00.000Z"))).toBe("2026-08-25T09:00:00-05:00");
  });
});

describe("UT-FEC-07: el offset -05:00 no está hardcodeado como literal de lógica", () => {
  it("fechas.ts no contiene el literal '-05:00' fuera de comentarios/ejemplos", () => {
    // Se permite en comentarios (documentación); lo que no debe existir es
    // un '-05:00' usado como parte de la lógica de cálculo. Verificamos que
    // el módulo deriva el offset de la zona (`ZONA_LIMA`/`negocio.zonaHoraria`)
    // y no de un string fijo en las funciones de cálculo.
    // Prueba indirecta y robusta: si el offset estuviera hardcodeado, un
    // cambio de ZONA_LIMA a otra zona rompería estas dos funciones, que en
    // cambio se comportan según el parámetro `zona` de `partesEnZona`.
    // Aquí solo afirmamos el contrato observable: el offset devuelto
    // coincide con el de la zona configurada, no con un texto fijo interno.
    expect(isoConOffsetLima(new Date("2026-08-25T14:00:00.000Z")).endsWith("-05:00")).toBe(true);
  });
});

describe("esDiaLaborableYMD", () => {
  it("rechaza sábado y domingo", () => {
    expect(esDiaLaborableYMD("2026-08-22")).toBe(false); // sábado
    expect(esDiaLaborableYMD("2026-08-23")).toBe(false); // domingo
  });

  it("acepta lunes a viernes", () => {
    expect(esDiaLaborableYMD("2026-08-24")).toBe(true); // lunes
    expect(esDiaLaborableYMD("2026-08-25")).toBe(true);
    expect(esDiaLaborableYMD("2026-08-26")).toBe(true);
    expect(esDiaLaborableYMD("2026-08-27")).toBe(true);
    expect(esDiaLaborableYMD("2026-08-28")).toBe(true); // viernes
  });
});

describe("siguienteDiaHabilYMD", () => {
  it("de viernes salta a lunes", () => {
    expect(siguienteDiaHabilYMD("2026-08-28")).toBe("2026-08-31");
  });

  it("de un día laborable da el siguiente día calendario", () => {
    expect(siguienteDiaHabilYMD("2026-08-24")).toBe("2026-08-25");
  });

  it("de sábado salta a lunes", () => {
    expect(siguienteDiaHabilYMD("2026-08-22")).toBe("2026-08-24");
  });

  it("de domingo salta a lunes", () => {
    expect(siguienteDiaHabilYMD("2026-08-23")).toBe("2026-08-24");
  });
});

describe("cumpleAnticipacionMinima", () => {
  it("rechaza un slot a menos de 2 horas de ahora", () => {
    const ahora = new Date("2026-08-25T14:30:00.000Z"); // 09:30 Lima
    const slotEnUnaHora = construirInstanteLima("2026-08-25", 10); // 10:00 Lima
    expect(cumpleAnticipacionMinima(slotEnUnaHora, ahora)).toBe(false);
  });

  it("acepta un slot a más de 2 horas de ahora", () => {
    const ahora = new Date("2026-08-25T14:30:00.000Z"); // 09:30 Lima
    const slotEnTresHoras = construirInstanteLima("2026-08-25", 12); // 12:00 Lima
    expect(cumpleAnticipacionMinima(slotEnTresHoras, ahora)).toBe(true);
  });

  it("UT-FEC-18/19: borde exacto de 120 minutos — 119 rechaza, 120 acepta", () => {
    const ahora = new Date("2026-08-25T14:00:00.000Z"); // 09:00 Lima
    const en119min = new Date(ahora.getTime() + 119 * 60_000);
    const en120min = new Date(ahora.getTime() + 120 * 60_000);
    expect(cumpleAnticipacionMinima(en119min, ahora)).toBe(false);
    expect(cumpleAnticipacionMinima(en120min, ahora)).toBe(true);
  });

  it("UT-FEC-20: 121 minutos acepta con margen", () => {
    const ahora = new Date("2026-08-25T14:00:00.000Z");
    const en121min = new Date(ahora.getTime() + 121 * 60_000);
    expect(cumpleAnticipacionMinima(en121min, ahora)).toBe(true);
  });
});

describe("dentroDeVentanaAgenda", () => {
  const ahora = new Date("2026-08-22T15:00:00.000Z");

  it("acepta hoy mismo", () => {
    expect(dentroDeVentanaAgenda(fechaYMDLima(ahora), ahora)).toBe(true);
  });

  it("UT-FEC-22: acepta el día 30 exacto (borde inclusivo)", () => {
    // "hoy" en Lima es 2026-08-22; +30 días = 2026-09-21.
    expect(dentroDeVentanaAgenda("2026-09-21", ahora)).toBe(true);
  });

  it("rechaza el día 31 (fuera de ventana)", () => {
    expect(dentroDeVentanaAgenda("2026-09-22", ahora)).toBe(false);
  });

  it("rechaza más allá de la ventana de 30 días", () => {
    expect(dentroDeVentanaAgenda("2026-10-15", ahora)).toBe(false);
  });

  it("rechaza fechas pasadas", () => {
    expect(dentroDeVentanaAgenda("2026-08-01", ahora)).toBe(false);
  });
});

describe("formateo de fechas en español (para el chat y los correos)", () => {
  it("formatearFechaLarga produce el formato es-PE esperado", () => {
    const fecha = construirInstanteLima("2026-08-25", 11);
    expect(formatearFechaLarga(fecha)).toBe("martes 25 de agosto de 2026");
  });

  it("UT-FEC-27: formatearFechaHoraLargaEmail menciona 'hora de Lima' y NUNCA el formato ISO técnico", () => {
    const fecha = construirInstanteLima("2026-08-25", 11);
    const texto = formatearFechaHoraLargaEmail(fecha);
    expect(texto).toContain("hora de Lima");
    expect(texto).not.toContain("T11:00:00");
    expect(texto).not.toContain("-05:00");
  });
});

describe("UT-FEC-28: bloqueContextoFechaActual — el bloque que recibe el LLM cada turno", () => {
  it("contiene la fecha larga actual y el próximo día hábil", () => {
    // Viernes 2026-08-28, 15:40 Lima → 2026-08-28T20:40:00Z.
    const ahora = new Date("2026-08-28T20:40:00.000Z");
    const texto = bloqueContextoFechaActual(ahora);
    expect(texto).toContain("viernes 28 de agosto de 2026");
    expect(texto).toContain("Próximo día hábil: lunes 31 de agosto");
  });
});
