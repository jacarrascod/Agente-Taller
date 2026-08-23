#!/usr/bin/env node
// Genera los placeholders SVG del catálogo (SPEC.md §13.3).
//
// Dirección de arte "catálogo técnico": papel milimetrado y DIBUJO DE LÍNEA
// (trazo, sin relleno), sin texto. La categoría y el SKU los pone la banda
// negra de la ficha que envuelve la imagen, así que repetirlos aquí duplicaría
// el dato. 800×600, objetivo < 4 KB por archivo.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_REPUESTOS = path.join(__dirname, "..", "public", "repuestos");
const DIR_MANTENIMIENTOS = path.join(__dirname, "..", "public", "mantenimientos");
const DIR_BRAND = path.join(__dirname, "..", "public", "brand");

// Tokens de §13.1
const GRIS_TALLER = "#EEEFF1";
const TINTA = "#16181D";
const ROJO = "#EB0A1E";
const BLANCO = "#FFFFFF";

const ANCHO = 800;
const ALTO = 600;

// ── Dibujos de línea ────────────────────────────────────────────────
// Todos devuelven trazos sin relleno; el grupo padre aplica stroke y width.

function cilindro(cx, cy) {
  return `
    <ellipse cx="${cx}" cy="${cy - 120}" rx="86" ry="26" />
    <path d="M${cx - 86} ${cy - 120} V${cy + 90} a86 26 0 0 0 172 0 V${cy - 120}" />
    <path d="M${cx - 50} ${cy - 96} V${cy + 104}" stroke-width="2" opacity="0.5" />
    <path d="M${cx - 17} ${cy - 90} V${cy + 110}" stroke-width="2" opacity="0.5" />
    <path d="M${cx + 17} ${cy - 90} V${cy + 110}" stroke-width="2" opacity="0.5" />
    <path d="M${cx + 50} ${cy - 96} V${cy + 104}" stroke-width="2" opacity="0.5" />
    <path d="M${cx - 40} ${cy + 138} h80 M${cx - 32} ${cy + 154} h64" stroke-width="3" opacity="0.7" />
  `;
}

function disco(cx, cy) {
  const pernos = Array.from({ length: 5 })
    .map((_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(cx + Math.cos(a) * 92).toFixed(1)}" cy="${(cy + Math.sin(a) * 92).toFixed(1)}" r="13" />`;
    })
    .join("");
  const ranuras = Array.from({ length: 8 })
    .map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * 128;
      const y1 = cy + Math.sin(a) * 128;
      const x2 = cx + Math.cos(a) * 160;
      const y2 = cy + Math.sin(a) * 160;
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="2" opacity="0.5" />`;
    })
    .join("");
  return `
    <circle cx="${cx}" cy="${cy}" r="170" />
    <circle cx="${cx}" cy="${cy}" r="124" stroke-width="2" opacity="0.6" />
    <circle cx="${cx}" cy="${cy}" r="52" />
    ${pernos}${ranuras}
  `;
}

function panel(cx, cy) {
  const pliegues = Array.from({ length: 11 })
    .map((_, i) => {
      const x = cx - 130 + i * 26;
      return `<path d="M${x} ${cy - 78} V${cy + 78}" stroke-width="2" opacity="0.5" />`;
    })
    .join("");
  return `
    <rect x="${cx - 150}" y="${cy - 100}" width="300" height="200" rx="8" />
    <rect x="${cx - 134}" y="${cy - 82}" width="268" height="164" stroke-width="2" opacity="0.6" />
    ${pliegues}
  `;
}

function bujia(cx, cy) {
  return `
    <rect x="${cx - 26}" y="${cy - 170}" width="52" height="110" rx="6" />
    <path d="M${cx - 44} ${cy - 60} h88 l-22 60 h-44 Z" />
    <rect x="${cx - 30}" y="${cy} " width="60" height="70" />
    <path d="M${cx - 22} ${cy + 70} h44 v46 h-44 Z" stroke-width="2" opacity="0.6" />
    <path d="M${cx} ${cy + 116} v34 M${cx} ${cy + 150} h26" stroke-width="3" />
  `;
}

function correa(cx, cy) {
  return `
    <circle cx="${cx - 120}" cy="${cy}" r="62" />
    <circle cx="${cx - 120}" cy="${cy}" r="26" stroke-width="2" opacity="0.6" />
    <circle cx="${cx + 110}" cy="${cy}" r="96" />
    <circle cx="${cx + 110}" cy="${cy}" r="40" stroke-width="2" opacity="0.6" />
    <path d="M${cx - 128} ${cy - 62} H${cx + 102} M${cx - 128} ${cy + 62} H${cx + 102}" stroke-width="2" opacity="0.5" />
  `;
}

function bateria(cx, cy) {
  return `
    <rect x="${cx - 150}" y="${cy - 90}" width="300" height="190" rx="6" />
    <rect x="${cx - 84}" y="${cy - 118}" width="34" height="28" rx="4" />
    <rect x="${cx + 50}" y="${cy - 118}" width="34" height="28" rx="4" />
    <path d="M${cx - 150} ${cy - 30} H${cx + 150}" stroke-width="2" opacity="0.5" />
    <path d="M${cx - 62} ${cy + 30} h44 M${cx - 40} ${cy + 8} v44" stroke-width="3" opacity="0.7" />
    <path d="M${cx + 20} ${cy + 30} h44" stroke-width="3" opacity="0.7" />
  `;
}

function bidon(cx, cy) {
  return `
    <rect x="${cx - 92}" y="${cy - 110}" width="184" height="230" rx="14" />
    <rect x="${cx - 34}" y="${cy - 152}" width="68" height="44" rx="6" />
    <path d="M${cx - 92} ${cy + 40} H${cx + 92}" stroke-width="2" opacity="0.5" />
    <rect x="${cx - 60}" y="${cy - 66}" width="120" height="80" stroke-width="2" opacity="0.6" />
  `;
}

function engranaje(cx, cy) {
  const dientes = Array.from({ length: 12 })
    .map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * 148;
      const y = cy + Math.sin(a) * 148;
      const g = ((a * 180) / Math.PI).toFixed(1);
      return `<rect x="${(x - 16).toFixed(1)}" y="${(y - 16).toFixed(1)}" width="32" height="32" transform="rotate(${g} ${x.toFixed(1)} ${y.toFixed(1)})" />`;
    })
    .join("");
  return `
    ${dientes}
    <circle cx="${cx}" cy="${cy}" r="140" />
    <circle cx="${cx}" cy="${cy}" r="46" />
    <circle cx="${cx}" cy="${cy}" r="96" stroke-width="2" opacity="0.5" />
  `;
}

function pluma(cx, cy) {
  return `
    <path d="M${cx - 200} ${cy + 10} h400" stroke-width="6" />
    <path d="M${cx - 180} ${cy - 12} h360" stroke-width="2" opacity="0.6" />
    <rect x="${cx - 26}" y="${cy - 62}" width="52" height="50" rx="6" />
    <path d="M${cx - 140} ${cy - 12} v22 M${cx + 140} ${cy - 12} v22" stroke-width="2" opacity="0.6" />
  `;
}

const FORMAS = { cilindro, disco, panel, bujia, correa, bateria, bidon, engranaje, pluma };

function construirSvg({ nombreCorto, forma }) {
  const cx = ANCHO / 2;
  const cy = ALTO / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${nombreCorto}">
  <defs>
    <pattern id="r" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0 H0 V32" fill="none" stroke="${TINTA}" stroke-width="1" opacity="0.06" />
    </pattern>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="${GRIS_TALLER}" />
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#r)" />
  <g fill="none" stroke="${TINTA}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    ${FORMAS[forma](cx, cy)}
  </g>
</svg>`;
}

const REPUESTOS = [
  { archivo: "filtro-aceite.svg", sku: "TOY-FIL-0001", nombreCorto: "Filtro de aceite", forma: "cilindro" },
  { archivo: "filtro-aire.svg", sku: "TOY-FIL-0002", nombreCorto: "Filtro de aire", forma: "panel" },
  { archivo: "filtro-combustible.svg", sku: "TOY-FIL-0003", nombreCorto: "Filtro de combustible", forma: "cilindro" },
  { archivo: "filtro-cabina.svg", sku: "TOY-FIL-0004", nombreCorto: "Filtro de cabina", forma: "panel" },
  { archivo: "pastillas-delanteras.svg", sku: "TOY-FRE-0001", nombreCorto: "Pastillas delanteras", forma: "panel" },
  { archivo: "pastillas-traseras.svg", sku: "TOY-FRE-0002", nombreCorto: "Pastillas traseras", forma: "panel" },
  { archivo: "discos-freno.svg", sku: "TOY-FRE-0003", nombreCorto: "Discos de freno", forma: "disco" },
  { archivo: "liquido-frenos.svg", sku: "TOY-FRE-0004", nombreCorto: "Líquido de frenos", forma: "bidon" },
  { archivo: "zapatas.svg", sku: "TOY-FRE-0005", nombreCorto: "Zapatas de freno", forma: "disco" },
  { archivo: "bujias.svg", sku: "TOY-MOT-0001", nombreCorto: "Bujías de iridio", forma: "bujia" },
  { archivo: "correa.svg", sku: "TOY-MOT-0002", nombreCorto: "Correa de accesorios", forma: "correa" },
  { archivo: "bomba-agua.svg", sku: "TOY-MOT-0003", nombreCorto: "Bomba de agua", forma: "cilindro" },
  { archivo: "kit-distribucion.svg", sku: "TOY-MOT-0004", nombreCorto: "Kit de distribución", forma: "engranaje" },
  { archivo: "radiador.svg", sku: "TOY-MOT-0005", nombreCorto: "Radiador", forma: "panel" },
  { archivo: "amortiguador.svg", sku: "TOY-SUS-0001", nombreCorto: "Amortiguador", forma: "cilindro" },
  { archivo: "rotula.svg", sku: "TOY-SUS-0002", nombreCorto: "Rótula de suspensión", forma: "bujia" },
  { archivo: "terminal-direccion.svg", sku: "TOY-SUS-0003", nombreCorto: "Terminal de dirección", forma: "bujia" },
  { archivo: "bateria.svg", sku: "TOY-ELE-0001", nombreCorto: "Batería 12V 60Ah", forma: "bateria" },
  { archivo: "alternador.svg", sku: "TOY-ELE-0002", nombreCorto: "Alternador 100A", forma: "cilindro" },
  { archivo: "faro-led.svg", sku: "TOY-ELE-0003", nombreCorto: "Faro LED derecho", forma: "panel" },
  { archivo: "aceite-5w30.svg", sku: "TOY-LUB-0001", nombreCorto: "Aceite 5W-30 (4L)", forma: "bidon" },
  { archivo: "refrigerante.svg", sku: "TOY-LUB-0002", nombreCorto: "Refrigerante SLLC", forma: "bidon" },
  { archivo: "kit-embrague.svg", sku: "TOY-TRA-0001", nombreCorto: "Kit de embrague", forma: "engranaje" },
  { archivo: "plumillas.svg", sku: "TOY-ACC-0001", nombreCorto: "Plumillas (par)", forma: "pluma" },
];

const MANTENIMIENTOS = [
  { archivo: "express-5k.svg", sku: "SERV-5K", nombreCorto: "Servicio Express 5K", forma: "cilindro" },
  { archivo: "preventivo-20k.svg", sku: "SERV-20K", nombreCorto: "Preventivo 20K", forma: "engranaje" },
  { archivo: "mayor-40k.svg", sku: "SERV-40K", nombreCorto: "Mantenimiento Mayor 40K", forma: "disco" },
];

function generarLote(items, dir) {
  mkdirSync(dir, { recursive: true });
  for (const item of items) {
    const svg = construirSvg(item);
    writeFileSync(path.join(dir, item.archivo), svg, "utf-8");
    console.log(
      `  ✓ ${path.relative(process.cwd(), path.join(dir, item.archivo))} (${(svg.length / 1024).toFixed(1)} KB)`,
    );
  }
}

// Monograma TTP: cuadro rojo, radio de 2 px como el resto del sistema.
function generarLogo() {
  mkdirSync(DIR_BRAND, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="Toyota Taller Perú">
  <rect width="240" height="240" rx="2" fill="${ROJO}" />
  <text x="120" y="148" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="78" font-weight="900" fill="${BLANCO}">TTP</text>
</svg>`;
  writeFileSync(path.join(DIR_BRAND, "logo-taller.svg"), svg, "utf-8");
  console.log(`  ✓ public/brand/logo-taller.svg`);
}

console.log("Generando placeholders de repuestos…");
generarLote(REPUESTOS, DIR_REPUESTOS);
console.log("Generando placeholders de mantenimientos…");
generarLote(MANTENIMIENTOS, DIR_MANTENIMIENTOS);
console.log("Generando logo de marca…");
generarLogo();
console.log(`\nListo: ${REPUESTOS.length} repuestos + ${MANTENIMIENTOS.length} mantenimientos + 1 logo.`);
