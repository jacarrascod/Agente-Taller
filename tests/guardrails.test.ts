import { describe, expect, it } from "vitest";
import {
  detectarMarcaAjena,
  evaluarGuardrailEntrada,
  respuestaEsEcoDelTurnoAnterior,
  respuestaParcialTieneDatoSinRespaldo,
  respuestaTieneDatoSinRespaldo,
} from "@/server/agent/guardrails";

const FRASES_MARCA_CON_INTENT = [
  "¿Tienen filtro de aceite para un Kia Rio 2019?",
  "Necesito pastillas de freno para mi Nissan Sentra",
  "¿Cuánto cuesta una batería para Hyundai Accent?",
  "Quiero agendar el mantenimiento de mi Chevrolet Spark",
  "¿Venden repuestos para Honda Civic?",
  "Cotízame un filtro de aire para Suzuki Swift",
  "¿Tienen stock de amortiguadores Mazda 3?",
  "Necesito cambiar el aceite de mi Ford Fiesta",
  "¿Cuánto vale un radiador para Volkswagen Gol?",
  "¿Tienen disponible una correa para BMW Serie 3?",
  "Quiero cotizar frenos para mi Mercedes Clase A",
  "¿Venden bujías para Audi A3?",
  "Necesito un alternador para mi BYD Han",
  "¿Tienen repuestos de Changan CS35?",
  "Cotízame filtros para Chery Tiggo",
  "¿Cuánto cuesta el mantenimiento de un Haval H6?",
  "Necesito pastillas de freno para Great Wall Poer",
  "¿Tienen kit de embrague para JAC S3?",
  "Quiero comprar una batería para MG ZS",
  "¿Venden refrigerante para Citroën C3?",
  "Necesito un filtro para mi Fiat Argo",
  "¿Cuánto cuesta un radiador Dodge Journey?",
  "Cotízame amortiguadores para RAM 1500",
  "¿Tienen repuestos Volvo XC60?",
  "Quiero agendar mantenimiento para mi Tesla Model 3",
  "¿Venden filtro de cabina para Renault Duster?",
  "Necesito bujías para mi Peugeot 208",
  "¿Cuánto vale un alternador Mitsubishi Montero?",
  "Cotízame pastillas para Subaru Forester",
  "¿Tienen repuestos para Jeep Compass?",
];

const FRASES_FALSOS_POSITIVOS = [
  "Vengo de un Nissan, ahora tengo un Corolla",
  "Antes tenía un Kia pero lo vendí",
  "Mi vecino tiene un Honda pero yo tengo un Toyota Hilux",
  "Comparado con mi antiguo Ford, el Corolla es más económico",
  "No me gustaba mi Mazda anterior",
  "Mi hermano trabaja arreglando Chevrolet, pero yo solo tengo un Toyota Yaris",
  "Tuve un accidente con un Suzuki hace años",
  "Mi tío maneja un Hyundai hace 10 años",
  "Mi primo tiene un BMW",
  "Leí que Volvo es una marca segura",
];

describe("detectarMarcaAjena — 30 casos con marca e intent de servicio", () => {
  it.each(FRASES_MARCA_CON_INTENT)("%s", (frase) => {
    const resultado = evaluarGuardrailEntrada(frase);
    expect(resultado.bloquear).toBe(true);
  });
});

describe("evaluarGuardrailEntrada — 10 falsos positivos que NO deben bloquear", () => {
  it.each(FRASES_FALSOS_POSITIVOS)("%s", (frase) => {
    const resultado = evaluarGuardrailEntrada(frase);
    expect(resultado.bloquear).toBe(false);
  });
});

describe("detectarMarcaAjena", () => {
  it("no detecta ninguna marca en un mensaje sobre Toyota", () => {
    expect(detectarMarcaAjena("Necesito pastillas de freno para mi Corolla 2018")).toBeNull();
  });
});

describe("respuestaTieneDatoSinRespaldo (capa 3)", () => {
  it("descarta un precio sin tool de respaldo", () => {
    expect(respuestaTieneDatoSinRespaldo("El filtro cuesta S/ 38.00.", [])).toBe(true);
  });

  it("permite un precio cuando se ejecutó buscar_repuestos en el turno", () => {
    expect(respuestaTieneDatoSinRespaldo("El filtro cuesta S/ 38.00.", ["buscar_repuestos"])).toBe(false);
  });

  it("descarta una hora ofrecida sin tool de agenda", () => {
    expect(respuestaTieneDatoSinRespaldo("Tenemos 11:00 disponible.", [])).toBe(true);
  });

  it("permite una hora cuando se consultó disponibilidad", () => {
    expect(
      respuestaTieneDatoSinRespaldo("Tenemos 11:00 disponible.", ["consultar_disponibilidad_agenda"]),
    ).toBe(false);
  });

  it("no marca nada cuando la respuesta no cita precio ni hora", () => {
    expect(respuestaTieneDatoSinRespaldo("Claro, cuénteme más sobre su Toyota.", [])).toBe(false);
  });

  // UT-GRD-62: listar_mantenimientos también justifica un precio (T3 del SPEC).
  it("permite un precio cuando se ejecutó listar_mantenimientos", () => {
    expect(
      respuestaTieneDatoSinRespaldo("El Express 5K cuesta S/ 189.00.", ["listar_mantenimientos"]),
    ).toBe(false);
  });

  // UT-GRD-63: consultar_citas también justifica una hora citada de una cita existente.
  it("permite una hora cuando se ejecutó consultar_citas", () => {
    expect(respuestaTieneDatoSinRespaldo("Su cita es a las 11:00.", ["consultar_citas"])).toBe(false);
  });

  // UT-GRD-54 / DEF-02: mencionar el horario fijo del taller (apertura–cierre)
  // no es una hora "ofrecida" — es un dato del prompt, no de una tool.
  it("NO descarta la respuesta cuando solo menciona el horario fijo del taller (DEF-02 corregido)", () => {
    expect(
      respuestaTieneDatoSinRespaldo("El taller atiende de lunes a viernes de 09:00 a 17:00.", []),
    ).toBe(false);
  });

  it("no descarta el horario del taller con guion en vez de 'a'", () => {
    expect(respuestaTieneDatoSinRespaldo("Horario: 09:00-17:00, L-V.", [])).toBe(false);
  });

  it("no descarta el horario del taller con en dash", () => {
    expect(respuestaTieneDatoSinRespaldo("Atendemos 09:00 – 17:00.", [])).toBe(false);
  });

  // Pero una hora suelta de cita SIGUE exigiendo la tool, incluso si coincide
  // con la hora de apertura — cierra el posible atajo que abriría exentar "09:00" solo.
  it("SÍ descarta una hora de cita ofrecida a las 09:00 sin tool, aunque coincida con la apertura", () => {
    expect(respuestaTieneDatoSinRespaldo("Tengo libre a las 09:00 si le acomoda.", [])).toBe(true);
  });

  it("SÍ descarta una hora de cita a las 16:00 sin tool", () => {
    expect(respuestaTieneDatoSinRespaldo("Le puedo agendar a las 16:00.", [])).toBe(true);
  });

  // UT-GRD-59/60: falsos positivos de patrón de hora sobre datos que no son horas.
  it("no confunde un número de parte con una hora", () => {
    expect(respuestaTieneDatoSinRespaldo("El número de parte es 90915-YZZD3.", [])).toBe(false);
  });

  it("no confunde un teléfono con una hora (sin dos puntos)", () => {
    expect(respuestaTieneDatoSinRespaldo("Puede llamarnos al (01) 715-4820.", [])).toBe(false);
  });

  // DEF-03 (corregido): un precio en letras ("...soles") también se
  // descarta sin respaldo de tool, no solo el formato "S/ 210.00".
  it("DEF-03 corregido: descarta un precio dictado en letras sin tool de respaldo", () => {
    expect(respuestaTieneDatoSinRespaldo("Le cuesta doscientos diez soles.", [])).toBe(true);
  });

  it("DEF-03: permite el precio en letras cuando sí hubo tool de respaldo", () => {
    expect(
      respuestaTieneDatoSinRespaldo("Le cuesta doscientos diez soles.", ["buscar_repuestos"]),
    ).toBe(false);
  });

  it("DEF-03: 'soles' en singular (astro) no dispara falso positivo — solo se vigila el plural", () => {
    expect(respuestaTieneDatoSinRespaldo("El taller tiene buena ventilación y luz natural.", [])).toBe(false);
  });
});

// Versión incremental de la capa 3: permite cortar el stream del LLM apenas
// la violación es inequívoca, en vez de esperar el párrafo completo que
// igual se va a descartar. Mismo criterio de respaldo; lo único que cambia
// es CUÁNDO se evalúa, así que ante la duda debe devolver `false`.
describe("respuestaParcialTieneDatoSinRespaldo (capa 3, corte anticipado)", () => {
  // Relleno neutro: sin horas, sin precios, solo para superar el margen.
  const RELLENO = " y quedo atento a su respuesta por favor gracias.";

  it("aún no decide cuando la hora recién apareció (podría ser el rango del taller)", () => {
    expect(respuestaParcialTieneDatoSinRespaldo("Tengo libre a las 09:00", [])).toBe(false);
  });

  it("corta cuando la hora ya no puede completarse como rango del taller", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(
        "El miércoles 26 de agosto tenemos libres a las 09:00, 10:00, 11:00, 12:00, 13:00 y 14:00.",
        [],
      ),
    ).toBe(true);
  });

  it("NO corta el rango fijo del taller aunque llegue texto de sobra (exención DEF-02 intacta)", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(
        "El taller atiende de 09:00 a 17:00, de lunes a viernes, sin cerrar al mediodía.",
        [],
      ),
    ).toBe(false);
  });

  it("no corta una hora cuando ya se consultó la disponibilidad en el turno", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(
        "El miércoles 26 de agosto tenemos libres a las 09:00, 10:00, 11:00, 12:00, 13:00 y 14:00.",
        ["consultar_disponibilidad_agenda"],
      ),
    ).toBe(false);
  });

  it("corta un precio sin tool de respaldo una vez superado el margen", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(
        "El filtro de aceite original cuesta S/ 38.00 e incluye IGV, y lo tenemos disponible.",
        [],
      ),
    ).toBe(true);
  });

  it("no corta un precio cuando se ejecutó buscar_repuestos en el turno", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(
        "El filtro de aceite original cuesta S/ 38.00 e incluye IGV, y lo tenemos disponible.",
        ["buscar_repuestos"],
      ),
    ).toBe(false);
  });

  it("no corta un texto sin precio ni hora por largo que sea", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(`Claro, cuénteme más sobre su Toyota.${RELLENO}`, []),
    ).toBe(false);
  });

  it("no confunde un número de parte con una hora", () => {
    expect(
      respuestaParcialTieneDatoSinRespaldo(`El número de parte es 90915-YZZD3.${RELLENO}`, []),
    ).toBe(false);
  });

  // La garantía que importa: la versión incremental NUNCA es más permisiva
  // que la definitiva. Si el texto completo se descarta, el corte anticipado
  // sobre ese mismo texto (con margen suficiente) también debe dispararse.
  describe("no relaja el criterio de la versión de texto completo", () => {
    const CASOS_QUE_DEBEN_DESCARTARSE = [
      "El filtro cuesta S/ 38.00.",
      "Tenemos 11:00 disponible.",
      "Tengo libre a las 09:00 si le acomoda.",
      "Le puedo agendar a las 16:00.",
      "Le cuesta doscientos diez soles.",
    ];

    it.each(CASOS_QUE_DEBEN_DESCARTARSE)("%s", (texto) => {
      expect(respuestaTieneDatoSinRespaldo(texto, [])).toBe(true);
      expect(respuestaParcialTieneDatoSinRespaldo(`${texto}${RELLENO}`, [])).toBe(true);
    });
  });
});

describe("detectarMarcaAjena — casos adicionales (UT-GRD-42..47)", () => {
  it("detecta la marca con un acento distinto (citroën)", () => {
    // La lista tiene ambas variantes ("citroen" y "citroën"); basta con que
    // detecte alguna — lo que importa es que no sea null.
    expect(detectarMarcaAjena("¿Tienen filtro para un Citroën C3?")).not.toBeNull();
  });

  it("detecta la marca en mayúsculas", () => {
    expect(detectarMarcaAjena("NECESITO REPUESTOS PARA NISSAN")).toBe("nissan");
  });

  it("detecta una marca de dos palabras (great wall)", () => {
    expect(detectarMarcaAjena("¿Tienen repuestos para Great Wall Poer?")).toBe("great wall");
  });

  it("no confunde 'imagen' con la marca MG (límite de palabra)", () => {
    expect(detectarMarcaAjena("¿Me puede enviar una imagen del repuesto?")).toBeNull();
  });

  it("no confunde 'programa' con la marca RAM (límite de palabra)", () => {
    expect(detectarMarcaAjena("¿Cuál es el programa de mantenimiento de mi Corolla?")).toBeNull();
  });

  it("no detecta marca ajena en modelos Toyota con nombres ambiguos", () => {
    expect(detectarMarcaAjena("Tengo una Land Cruiser 2020")).toBeNull();
    expect(detectarMarcaAjena("Mi RAV4 hace un ruido raro")).toBeNull();
  });
});

// DEF-24 (INFORME-E2E-NAVEGACION-REAL.md): navegando en vivo contra el LLM
// real, una pregunta nueva y sin relación recibió como respuesta el texto
// idéntico del turno anterior. Este guardrail lo detecta para poder darle
// al modelo una oportunidad de corregirse en vez de dejarlo pasar.
describe("respuestaEsEcoDelTurnoAnterior (capa 3, DEF-24)", () => {
  const historialConCita = [
    { rol: "user" as const, contenido: "¿Tengo alguna cita? mi correo es ana@ejemplo.com" },
    { rol: "assistant" as const, contenido: "Hola Ana, sí tiene una cita confirmada para el lunes a las 10:00." },
  ];

  it("detecta cuando la respuesta repite el turno anterior ante una pregunta nueva", () => {
    expect(
      respuestaEsEcoDelTurnoAnterior(
        "Hola Ana, sí tiene una cita confirmada para el lunes a las 10:00.",
        historialConCita,
        "¿Cuál es la capital de Francia?",
      ),
    ).toBe(true);
  });

  it("no marca nada cuando la respuesta es distinta de la anterior", () => {
    expect(
      respuestaEsEcoDelTurnoAnterior(
        "Disculpe, solo atendemos consultas sobre Toyota. ¿En qué le ayudo?",
        historialConCita,
        "¿Cuál es la capital de Francia?",
      ),
    ).toBe(false);
  });

  it("no marca nada cuando el cliente repite la misma pregunta (la misma respuesta es correcta)", () => {
    expect(
      respuestaEsEcoDelTurnoAnterior(
        "Hola Ana, sí tiene una cita confirmada para el lunes a las 10:00.",
        historialConCita,
        "¿Tengo alguna cita? mi correo es ana@ejemplo.com",
      ),
    ).toBe(false);
  });

  it("no marca nada en el primer turno de la conversación (sin historial previo)", () => {
    expect(respuestaEsEcoDelTurnoAnterior("Hola, ¿en qué le ayudo?", [], "Hola")).toBe(false);
  });

  it("ignora diferencias de mayúsculas y espacios al comparar", () => {
    expect(
      respuestaEsEcoDelTurnoAnterior(
        "  HOLA ANA, SÍ TIENE UNA CITA CONFIRMADA PARA EL LUNES A LAS 10:00.  ",
        historialConCita,
        "¿Cuál es la capital de Francia?",
      ),
    ).toBe(true);
  });
});
