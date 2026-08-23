#!/usr/bin/env tsx
// Harness de evals conversacionales (SPEC.md §16.1, capa 2).
//
// Ejecuta los criterios de aceptación CONTRA EL AGENTE REAL, vía HTTP.
// Requiere que el servidor ya esté corriendo (`npm run dev` o `npm start`)
// apuntando a credenciales válidas de NVIDIA NIM y Supabase.
//
// Por defecto se asume que el servidor corre con
// EMAIL_PROVIDER=consola y CALENDAR_PROVIDER=mock (para no gastar cuota de
// Brevo ni ensuciar el calendario real): arráncalo así antes de evaluar.
// `--real` es solo un recordatorio en consola de que el servidor debería
// estar corriendo con los proveedores reales — este script no puede
// cambiar el entorno de un proceso ya iniciado.
//
// Uso:
//   npm run eval                  → corre todos los casos
//   npm run eval -- --caso CA-13  → corre un solo caso
//   npm run eval -- --real        → recuerda validar contra proveedores reales

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.EVAL_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REPETICIONES = 3;
const UMBRAL_MINIMO = 0.9;

interface Espera {
  tools_requeridas?: string[];
  tools_prohibidas?: string[];
  texto_contiene?: string[];
  texto_no_contiene?: string[];
  max_preguntas?: number;
}

interface Caso {
  id: string;
  turnos: string[];
  espera: Espera;
}

interface EventoSSE {
  evento: string;
  datos: unknown;
}

async function* leerSSE(response: Response): AsyncGenerator<EventoSSE> {
  if (!response.body) return;
  const lector = response.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });
    const bloques = buffer.split("\n\n");
    buffer = bloques.pop() ?? "";
    for (const bloque of bloques) {
      let evento = "message";
      let datosCrudos = "";
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith("event:")) evento = linea.slice(6).trim();
        else if (linea.startsWith("data:")) datosCrudos += linea.slice(5).trim();
      }
      if (!datosCrudos) continue;
      try {
        yield { evento, datos: JSON.parse(datosCrudos) };
      } catch {
        yield { evento, datos: datosCrudos };
      }
    }
  }
}

async function correrTurno(sessionId: string, mensaje: string): Promise<{ texto: string; tools: string[] }> {
  const respuesta = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, mensaje }),
  });
  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} al llamar /api/chat`);
  }
  let texto = "";
  const tools: string[] = [];
  for await (const evento of leerSSE(respuesta)) {
    if (evento.evento === "tool_end") {
      const { nombre } = evento.datos as { nombre: string };
      tools.push(nombre);
    } else if (evento.evento === "done") {
      const { texto_final } = evento.datos as { texto_final: string };
      texto = texto_final;
    } else if (evento.evento === "error") {
      const { mensaje: msg } = evento.datos as { mensaje: string };
      throw new Error(`El agente devolvió un error: ${msg}`);
    }
  }
  return { texto, tools };
}

interface ResultadoIntento {
  ok: boolean;
  detalle: string[];
  texto: string;
  tools: string[];
}

function evaluar(espera: Espera, texto: string, tools: string[]): ResultadoIntento {
  const detalle: string[] = [];
  let ok = true;

  if (espera.tools_requeridas) {
    for (const t of espera.tools_requeridas) {
      if (!tools.includes(t)) {
        ok = false;
        detalle.push(`Faltó llamar a la tool requerida: ${t}`);
      }
    }
  }
  if (espera.tools_prohibidas) {
    for (const t of espera.tools_prohibidas) {
      if (tools.includes(t)) {
        ok = false;
        detalle.push(`Se llamó a una tool prohibida: ${t}`);
      }
    }
  }
  if (espera.texto_contiene && espera.texto_contiene.length > 0) {
    const encontrado = espera.texto_contiene.some((s) => texto.toLowerCase().includes(s.toLowerCase()));
    if (!encontrado) {
      ok = false;
      detalle.push(`El texto no contiene ninguna de las formas esperadas: ${espera.texto_contiene.join(" | ")}`);
    }
  }
  if (espera.texto_no_contiene) {
    for (const s of espera.texto_no_contiene) {
      if (texto.toLowerCase().includes(s.toLowerCase())) {
        ok = false;
        detalle.push(`El texto contiene un fragmento prohibido: "${s}"`);
      }
    }
  }
  if (espera.max_preguntas !== undefined) {
    const preguntas = (texto.match(/\?/g) ?? []).length / 2; // signos ¿ ? cuentan como par
    if (preguntas > espera.max_preguntas) {
      ok = false;
      detalle.push(`Demasiadas preguntas en un turno: ~${preguntas} (máximo ${espera.max_preguntas})`);
    }
  }

  return { ok, detalle, texto, tools };
}

async function correrCaso(caso: Caso): Promise<{ pasadas: number; intentos: ResultadoIntento[] }> {
  const intentos: ResultadoIntento[] = [];
  for (let i = 0; i < REPETICIONES; i++) {
    const sessionId = randomUUID();
    try {
      let ultimoTexto = "";
      let todasLasTools: string[] = [];
      for (const turno of caso.turnos) {
        const { texto, tools } = await correrTurno(sessionId, turno);
        ultimoTexto = texto;
        todasLasTools = [...todasLasTools, ...tools];
      }
      intentos.push(evaluar(caso.espera, ultimoTexto, todasLasTools));
    } catch (error) {
      intentos.push({
        ok: false,
        detalle: [error instanceof Error ? error.message : "Error desconocido"],
        texto: "",
        tools: [],
      });
    }
  }
  const pasadas = intentos.filter((i) => i.ok).length;
  return { pasadas, intentos };
}

async function main() {
  const args = process.argv.slice(2);
  const idxCaso = args.indexOf("--caso");
  const filtroCaso = idxCaso >= 0 ? args[idxCaso + 1] : null;
  const modoReal = args.includes("--real");

  console.log(`Servidor objetivo: ${BASE_URL}`);
  console.log(
    modoReal
      ? "Modo --real: asegúrate de que el servidor corre con EMAIL_PROVIDER=brevo y CALENDAR_PROVIDER=google.\n"
      : "Modo por defecto: asegúrate de que el servidor corre con EMAIL_PROVIDER=consola y CALENDAR_PROVIDER=mock.\n",
  );

  const rutaCasos = path.join(__dirname, "casos.jsonl");
  const lineas = readFileSync(rutaCasos, "utf-8").split("\n").filter((l) => l.trim());
  let casos: Caso[] = lineas.map((l) => JSON.parse(l));
  if (filtroCaso) casos = casos.filter((c) => c.id === filtroCaso);

  if (casos.length === 0) {
    console.error(`No se encontraron casos${filtroCaso ? ` con id "${filtroCaso}"` : ""}.`);
    process.exit(1);
  }

  const resultados: { id: string; pasadas: number; ok: boolean; intentos: ResultadoIntento[] }[] = [];

  for (const caso of casos) {
    process.stdout.write(`  ${caso.id} … `);
    const { pasadas, intentos } = await correrCaso(caso);
    const ok = pasadas >= 2; // 2 de 3 (SPEC.md §16.1)
    resultados.push({ id: caso.id, pasadas, ok, intentos });
    console.log(ok ? `✓ (${pasadas}/${REPETICIONES})` : `✗ (${pasadas}/${REPETICIONES})`);
    if (!ok) {
      for (const intento of intentos) {
        if (!intento.ok) console.log(`      - ${intento.detalle.join("; ")}`);
      }
    }
  }

  const totalPasados = resultados.filter((r) => r.ok).length;
  const proporcion = totalPasados / resultados.length;

  console.log(`\n${totalPasados}/${resultados.length} casos pasaron (${(proporcion * 100).toFixed(1)}%).`);
  console.log(proporcion >= UMBRAL_MINIMO ? "✓ Supera el umbral del 90%." : "✗ No alcanza el umbral del 90%.");

  const salida = {
    fecha: new Date().toISOString(),
    servidor: BASE_URL,
    total: resultados.length,
    pasados: totalPasados,
    proporcion,
    casos: resultados,
  };
  const rutaSalida = path.join(__dirname, "resultado.json");
  await import("node:fs").then((fs) => fs.writeFileSync(rutaSalida, JSON.stringify(salida, null, 2)));
  console.log(`\nEvidencia guardada en ${path.relative(process.cwd(), rutaSalida)}`);

  process.exit(proporcion >= UMBRAL_MINIMO ? 0 : 1);
}

main().catch((error) => {
  console.error("Fallo inesperado del harness de evals:", error);
  process.exit(1);
});
