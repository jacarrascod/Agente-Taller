#!/usr/bin/env node
// CI: falla si las credenciales sensibles se referencian fuera de
// src/server/** (SPEC.md §5, "regla de oro"). Recorre src/ a mano — sin
// dependencias nuevas — para no acoplar el check a una herramienta externa.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "..", "src");
const SERVER_DIR = path.join(SRC_DIR, "server");

const CLAVES_PROHIBIDAS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NVIDIA_API_KEY",
  "GROQ_API_KEY",
  "OPENAI_TOKEN",
  "GOOGLE_PRIVATE_KEY",
  "BREVO_API_KEY",
];

const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".mjs"]);

function listarArchivos(dir) {
  const resultado = [];
  for (const entrada of readdirSync(dir)) {
    const rutaCompleta = path.join(dir, entrada);
    const info = statSync(rutaCompleta);
    if (info.isDirectory()) {
      resultado.push(...listarArchivos(rutaCompleta));
    } else if (EXTENSIONES.has(path.extname(entrada))) {
      resultado.push(rutaCompleta);
    }
  }
  return resultado;
}

function esRutaServidor(rutaAbsoluta) {
  const relativa = path.relative(SERVER_DIR, rutaAbsoluta);
  return !relativa.startsWith("..") && !path.isAbsolute(relativa);
}

const archivos = listarArchivos(SRC_DIR).filter((f) => !esRutaServidor(f));
const hallazgos = [];

for (const archivo of archivos) {
  const contenido = readFileSync(archivo, "utf-8");
  for (const clave of CLAVES_PROHIBIDAS) {
    if (contenido.includes(clave)) {
      hallazgos.push({ archivo: path.relative(process.cwd(), archivo), clave });
    }
  }
}

if (hallazgos.length > 0) {
  console.error("✗ Credenciales sensibles referenciadas fuera de src/server/**:\n");
  for (const h of hallazgos) {
    console.error(`  ${h.archivo} → ${h.clave}`);
  }
  console.error("\nMueve ese acceso a un módulo dentro de src/server/**.");
  process.exit(1);
}

console.log(`✓ Ninguna credencial sensible fuera de src/server/** (${archivos.length} archivos revisados).`);
