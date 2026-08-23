#!/usr/bin/env node
// Descarga fotos reales de licencia abierta para el catálogo (SPEC.md §13.3),
// como reemplazo de los placeholders SVG de scripts/generar-placeholders.mjs.
//
// Fuente primaria: Wikimedia Commons con búsqueda `intitle:"frase exacta"`
// (alta precisión: el título del archivo debe contener la frase completa).
// Fallback 1: Commons con búsqueda de texto libre (más resultados, menos
// precisión). Fallback 2: Openverse (agrega Flickr y otros — mucho ruido de
// fotos de ciclismo/amateur para términos como "brake pads", así que se usa
// solo como último recurso). Todos los candidatos pasan un filtro de
// palabras bloqueadas (bicicleta, joyería, juguetes, etc.) y de palabras
// requeridas (las del término de búsqueda deben aparecer en el título),
// porque la búsqueda de texto libre es ruidosa y "foto con licencia válida"
// no es lo mismo que "foto del repuesto correcto".
//
// Solo se aceptan licencias que permiten modificación (CC0, CC-BY, CC-BY-SA,
// dominio público) — se descarta cualquier variante "No Derivatives" porque
// el pipeline redimensiona/recodifica las imágenes.
//
// Si un ítem no consigue una foto que pase todos los filtros, se deja
// intacto el placeholder SVG ya generado (no se borra nada) y se reporta
// como omitido, para que el catálogo nunca se quede sin imagen (CA-19).
// CADA IMAGEN DESCARGADA DEBE REVISARSE VISUALMENTE ANTES DE DARLA POR
// BUENA: estos filtros reducen el ruido, no lo eliminan.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_REPUESTOS = path.join(__dirname, "..", "public", "repuestos");
const DIR_MANTENIMIENTOS = path.join(__dirname, "..", "public", "mantenimientos");
const CREDITOS_PATH = path.join(__dirname, "..", "public", "CREDITOS-IMAGENES.md");

const USER_AGENT =
  "ToyotaTallerPeru-ProyectoAcademico/1.0 (demo sin fines de lucro; contacto: conversandoapp@gmail.com)";
const ESPERA_MS = 350;
const LICENCIAS_VALIDAS = new Set(["cc0", "pdm", "by", "by-sa"]);

// terminoBusqueda: frase en inglés usada tal cual para intitle exacto en Commons.
// requeridas: palabras que DEBEN aparecer en el título del candidato (si se
// omite, se derivan de terminoBusqueda). Se usan términos "car "/"automotive"
// explícitos en los repuestos que tienen un equivalente común en bicicletas
// (frenos, amortiguación, embrague) para no traer fotos de ciclismo.
const REPUESTOS = [
  { archivo: "filtro-aceite", nombreCorto: "Filtro de aceite", terminoBusqueda: "oil filter" },
  { archivo: "filtro-aire", nombreCorto: "Filtro de aire", terminoBusqueda: "engine air filter", requeridas: ["air", "filter"] },
  { archivo: "filtro-combustible", nombreCorto: "Filtro de combustible", terminoBusqueda: "fuel filter" },
  { archivo: "filtro-cabina", nombreCorto: "Filtro de cabina", terminoBusqueda: "cabin air filter" },
  { archivo: "pastillas-delanteras", nombreCorto: "Pastillas delanteras", terminoBusqueda: "brake pad", requeridas: ["brake", "pad"] },
  { archivo: "pastillas-traseras", nombreCorto: "Pastillas traseras", terminoBusqueda: "brake pad", requeridas: ["brake", "pad"] },
  { archivo: "discos-freno", nombreCorto: "Discos de freno", terminoBusqueda: "car brake disc" },
  { archivo: "liquido-frenos", nombreCorto: "Líquido de frenos", terminoBusqueda: "brake fluid" },
  { archivo: "zapatas", nombreCorto: "Zapatas de freno", terminoBusqueda: "brake shoe of a car", requeridas: ["brake", "shoe"] },
  { archivo: "bujias", nombreCorto: "Bujías de iridio", terminoBusqueda: "spark plug" },
  { archivo: "correa", nombreCorto: "Correa de accesorios", terminoBusqueda: "serpentine belt" },
  { archivo: "bomba-agua", nombreCorto: "Bomba de agua", terminoBusqueda: "car water pump" },
  { archivo: "kit-distribucion", nombreCorto: "Kit de distribución", terminoBusqueda: "timing belt", requeridas: ["timing", "belt"] },
  { archivo: "radiador", nombreCorto: "Radiador", terminoBusqueda: "car radiator" },
  { archivo: "amortiguador", nombreCorto: "Amortiguador", terminoBusqueda: "car shock absorber" },
  { archivo: "rotula", nombreCorto: "Rótula de suspensión", terminoBusqueda: "ball joint", requeridas: ["ball", "joint"] },
  { archivo: "terminal-direccion", nombreCorto: "Terminal de dirección", terminoBusqueda: "tie rod end" },
  { archivo: "bateria", nombreCorto: "Batería 12V 60Ah", terminoBusqueda: "car battery" },
  { archivo: "alternador", nombreCorto: "Alternador 100A", terminoBusqueda: "car alternator" },
  { archivo: "faro-led", nombreCorto: "Faro LED derecho", terminoBusqueda: "car headlight", requeridas: ["car", "headlight"] },
  { archivo: "aceite-5w30", nombreCorto: "Aceite 5W-30 (4L)", terminoBusqueda: "motor oil bottle" },
  { archivo: "refrigerante", nombreCorto: "Refrigerante SLLC", terminoBusqueda: "engine coolant", requeridas: ["coolant"] },
  { archivo: "kit-embrague", nombreCorto: "Kit de embrague", terminoBusqueda: "clutch plate", requeridas: ["clutch"] },
  { archivo: "plumillas", nombreCorto: "Plumillas (par)", terminoBusqueda: "windshield wiper blade" },
];

const MANTENIMIENTOS = [
  { archivo: "express-5k", nombreCorto: "Servicio Express 5K", terminoBusqueda: "car mechanic oil change", requeridas: ["mechanic"] },
  { archivo: "preventivo-20k", nombreCorto: "Preventivo 20K", terminoBusqueda: "car mechanic garage", requeridas: ["mechanic"] },
  { archivo: "mayor-40k", nombreCorto: "Mantenimiento Mayor 40K", terminoBusqueda: "car engine repair mechanic", requeridas: ["mechanic"] },
];

// Cualquier candidato cuyo título contenga una de estas palabras se descarta
// de plano, sin importar qué tan bien haya matcheado la búsqueda: son las
// falsas alarmas más comunes al buscar términos automotrices en bancos de
// fotos con mucho contenido de ciclismo, joyería, arte abstracto o fauna.
const PALABRAS_BLOQUEADAS = [
  "bike", "bicycle", "cycling", "cyclist", "mtb", "bmx", "shimano", "sram", "campagnolo",
  "motorcycle", "motorbike", "moped", "scooter",
  "bracelet", "necklace", "ring", "pendant", "jewelry", "jewellery", "earring", "charm",
  "toy", "lego", "cartoon", "clipart", "icon", "drawing", "sketch", "painting", "abstract",
  "wheelchair", "skateboard", "skate",
  "squirrel", "rodent", "mouse", "rat", "nest", "nuts", "acorn",
  "logo", "flag", "map",
  "wrench", "mine", "mining", "hoist", "coal", "spectra", "hydrocarbon", "hydrocarbons",
  "fungus", "mold", "microform", "book", "manuscript",
  "anatomy", "skeleton", "medical", "hip", "shoulder", "knee", "orthopedic", "prosthetic",
  "purse", "handbag", "bag", "dance",
  "computer", "processor", "cpu", "gpu", "aquarium", "nuclear", "reactor",
  "train", "railway", "locomotive", "tractor", "aircraft", "aviation", "airplane", "plane",
  "boat", "ship", "diagram", "illustration", "engraving", "figure", "fmib",
];

// Solo fotos, no escaneos de libros/documentos ni formatos vectoriales.
const MIME_VALIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

function palabrasRequeridas(item) {
  if (item.requeridas) return item.requeridas.map((p) => p.toLowerCase());
  return item.terminoBusqueda
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length >= 3);
}

function contienePalabra(texto, palabra) {
  const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapada}s?\\b`, "i").test(texto);
}

function pasaFiltro(titulo, requeridas) {
  if (PALABRAS_BLOQUEADAS.some((p) => contienePalabra(titulo, p))) return false;
  return requeridas.every((p) => contienePalabra(titulo, p));
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscarEnOpenverse(termino, usados, requeridas) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(termino)}&license_type=modification&mature=false&page_size=20`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const candidato = (data.results ?? []).find(
    (r) =>
      r.width >= 600 &&
      r.height >= 400 &&
      !r.mature &&
      !usados.has(r.id) &&
      (!r.mime_type || MIME_VALIDOS.has(r.mime_type)) &&
      LICENCIAS_VALIDAS.has((r.license ?? "").toLowerCase()) &&
      pasaFiltro(r.title || "", requeridas),
  );
  if (!candidato) return null;
  return {
    id: candidato.id,
    urlImagen: candidato.url,
    titulo: candidato.title || "(sin título)",
    autor: candidato.creator || "(desconocido)",
    autorUrl: candidato.creator_url || "",
    licencia: `${(candidato.license || "").toUpperCase()} ${candidato.license_version || ""}`.trim(),
    licenciaUrl: candidato.license_url || "",
    fuenteUrl: candidato.foreign_landing_url || candidato.url,
    proveedor: candidato.provider || "openverse",
  };
}

const LICENCIAS_COMMONS_VALIDAS = [/^cc0/i, /^public domain/i, /^cc[\s-]?by(?![\s-]?nd)/i];

async function buscarEnWikimediaCommons(gsrsearch, usados, requeridas) {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6" +
    `&gsrsearch=${encodeURIComponent(gsrsearch)}&gsrlimit=15&prop=imageinfo` +
    "&iiprop=url|extmetadata|size|mime&format=json&origin=*";
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  const paginas = Object.values(data.query?.pages ?? {});
  for (const pagina of paginas) {
    const info = pagina.imageinfo?.[0];
    if (!info) continue;
    if (!MIME_VALIDOS.has(info.mime)) continue;
    if (info.width < 600 || info.height < 400) continue;
    if (usados.has(`commons:${pagina.pageid}`)) continue;
    if (!pasaFiltro(pagina.title || "", requeridas)) continue;
    const licenciaCorta = info.extmetadata?.LicenseShortName?.value ?? "";
    const esValida = LICENCIAS_COMMONS_VALIDAS.some((re) => re.test(licenciaCorta));
    if (!esValida) continue;
    return {
      id: `commons:${pagina.pageid}`,
      urlImagen: info.url,
      titulo: pagina.title || "(sin título)",
      autor: (info.extmetadata?.Artist?.value ?? "(desconocido)").replace(/<[^>]+>/g, "").trim(),
      autorUrl: "",
      licencia: licenciaCorta,
      licenciaUrl: info.extmetadata?.LicenseUrl?.value ?? "",
      fuenteUrl: info.descriptionurl || info.url,
      proveedor: "wikimedia commons",
    };
  }
  return null;
}

// Commons primero con frase exacta en el título (alta precisión), luego
// texto libre en Commons, y Openverse solo como último recurso (más ruido).
async function buscarCandidato(termino, usados, requeridas) {
  let candidato = await buscarEnWikimediaCommons(`intitle:"${termino}"`, usados, requeridas);
  if (candidato) return candidato;

  await esperar(ESPERA_MS);
  candidato = await buscarEnWikimediaCommons(termino, usados, requeridas);
  if (candidato) return candidato;

  await esperar(ESPERA_MS);
  return buscarEnOpenverse(termino, usados, requeridas);
}

// Overrides encontrados a mano tras revisar visualmente cada descarga (ver
// nota al inicio del archivo): la búsqueda automática con estos términos
// devolvía resultados con la licencia correcta pero el sujeto equivocado
// (edificios de oficinas, maquetas a escala, diagramas técnicos, piezas de
// bicicleta). Se fijan aquí para no depender de que el ranking de búsqueda
// no cambie entre corridas.
const OVERRIDES_MANUALES = {
  "filtro-aceite": {
    id: "commons:4339654", urlImagen: "https://upload.wikimedia.org/wikipedia/commons/2/23/Oil_filter.JPG",
    titulo: "Oil filter", autor: "PHGCOM", autorUrl: "https://commons.wikimedia.org/wiki/User:PHGCOM",
    licencia: "CC BY-SA 3.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    fuenteUrl: "https://commons.wikimedia.org/wiki/File:Oil_filter.JPG", proveedor: "wikimedia commons",
  },
  "bateria": {
    id: "commons:154126174", urlImagen: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Super_Start_Platinum_Car_Battery.jpg",
    titulo: "Super Start Platinum Car Battery", autor: "TaurusEmerald",
    autorUrl: "https://commons.wikimedia.org/wiki/User:TaurusEmerald",
    licencia: "CC BY-SA 4.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    fuenteUrl: "https://commons.wikimedia.org/wiki/File:Super_Start_Platinum_Car_Battery.jpg", proveedor: "wikimedia commons",
  },
  "pastillas-delanteras": {
    id: "commons:16498941", urlImagen: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Performance_Disk_Brake_Pads.jpg",
    titulo: "Performance Disk Brake Pads", autor: "Treemonster86",
    autorUrl: "https://commons.wikimedia.org/w/index.php?title=User:Treemonster86&action=edit&redlink=1",
    licencia: "CC BY-SA 3.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    fuenteUrl: "https://commons.wikimedia.org/w/index.php?curid=16498941", proveedor: "wikimedia commons",
  },
  "pastillas-traseras": {
    id: "commons:16498941-b", urlImagen: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Performance_Disk_Brake_Pads.jpg",
    titulo: "Performance Disk Brake Pads", autor: "Treemonster86",
    autorUrl: "https://commons.wikimedia.org/w/index.php?title=User:Treemonster86&action=edit&redlink=1",
    licencia: "CC BY-SA 3.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    fuenteUrl: "https://commons.wikimedia.org/w/index.php?curid=16498941", proveedor: "wikimedia commons",
  },
  "bujias": {
    id: "openverse:4dc87b02", urlImagen: "https://live.staticflickr.com/3066/2819656917_3dfab47a92_b.jpg",
    titulo: "Spark plug", autor: "Razor512", autorUrl: "https://www.flickr.com/photos/13144581@N00",
    licencia: "CC BY 2.0", licenciaUrl: "https://creativecommons.org/licenses/by/2.0/",
    fuenteUrl: "https://www.flickr.com/photos/13144581@N00/2819656917", proveedor: "flickr",
  },
  "radiador": {
    id: "openverse:d88d4453", urlImagen: "https://live.staticflickr.com/6030/5976237798_8a11b95dab_b.jpg",
    titulo: "Aluminum Radiator Install", autor: "aresauburn™", autorUrl: "https://www.flickr.com/photos/9993075@N06",
    licencia: "CC BY-SA 2.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    fuenteUrl: "https://www.flickr.com/photos/9993075@N06/5976237798", proveedor: "flickr",
  },
  "amortiguador": {
    id: "commons:25621210",
    urlImagen: "https://upload.wikimedia.org/wikipedia/commons/2/23/%22_13_-_ITALY_-_Fiat_Panda_2003_suspension_shock_absorbers_-_Automotive_suspension_technologies_and_disk_brake.JPG",
    titulo: "Fiat Panda 2003 suspension shock absorbers", autor: "(ver página de origen)", autorUrl: "",
    licencia: "CC BY-SA 3.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    fuenteUrl: "https://commons.wikimedia.org/wiki/File:%22_13_-_ITALY_-_Fiat_Panda_2003_suspension_shock_absorbers_-_Automotive_suspension_technologies_and_disk_brake.JPG",
    proveedor: "wikimedia commons",
  },
  "refrigerante": {
    id: "openverse:36ba7c15", urlImagen: "https://live.staticflickr.com/7449/16200041699_39d0935bd5_b.jpg",
    titulo: "Coolant bottle", autor: "lw5315us", autorUrl: "https://www.flickr.com/photos/13456893@N04",
    licencia: "CC BY-SA 2.0", licenciaUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    fuenteUrl: "https://www.flickr.com/photos/13456893@N04/16200041699", proveedor: "flickr",
  },
};

// Términos que, tras revisión visual, solo devolvían fotos irrelevantes
// (motor en miniatura, camión de bomberos, diagrama militar...) sin que se
// encontrara un reemplazo confiable dentro del tiempo disponible. Se
// excluyen de la búsqueda automática a propósito: mantienen su placeholder
// SVG en vez de arriesgar otra foto incorrecta.
const EXCLUIDOS_FORZADOS = new Set(["filtro-aire", "filtro-combustible", "correa", "bomba-agua", "preventivo-20k"]);

function extensionDesdeContentType(contentType) {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function fetchConReintentos(url, intentos = 3) {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`descarga falló: HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (intento === intentos) throw err;
      await esperar(500 * intento);
    }
  }
}

async function descargarYNormalizar(urlImagen, rutaBase) {
  const res = await fetchConReintentos(urlImagen);
  const buffer = Buffer.from(await res.arrayBuffer());

  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const jpegBuffer = await sharp(buffer)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const ruta = `${rutaBase}.jpg`;
    writeFileSync(ruta, jpegBuffer);
    return { ruta, extension: "jpg", normalizado: true };
  } catch {
    const extension = extensionDesdeContentType(res.headers.get("content-type"));
    const ruta = `${rutaBase}.${extension}`;
    writeFileSync(ruta, buffer);
    return { ruta, extension, normalizado: false };
  }
}

async function procesarItem(item, dir, usados, creditos, omitidos) {
  const rutaBase = path.join(dir, item.archivo);

  if (EXCLUIDOS_FORZADOS.has(item.archivo)) {
    console.warn(`  ⚠ ${item.archivo}: excluido a propósito (ver EXCLUIDOS_FORZADOS) — se mantiene el placeholder SVG`);
    omitidos.push(item.archivo);
    return;
  }

  const requeridas = palabrasRequeridas(item);
  const candidato = OVERRIDES_MANUALES[item.archivo] ?? (await buscarCandidato(item.terminoBusqueda, usados, requeridas));

  if (!candidato) {
    console.warn(`  ⚠ ${item.archivo}: sin resultado con licencia válida para "${item.terminoBusqueda}" — se mantiene el placeholder SVG`);
    omitidos.push(item.archivo);
    return;
  }

  try {
    const { ruta, extension, normalizado } = await descargarYNormalizar(candidato.urlImagen, rutaBase);
    usados.add(candidato.id);
    creditos.push({ archivo: `${item.archivo}.${extension}`, ...candidato });
    console.log(
      `  ✓ ${path.relative(process.cwd(), ruta)} ← ${candidato.proveedor} (${candidato.licencia || "sin licencia declarada"}${normalizado ? "" : ", sin normalizar"}) — "${candidato.titulo}"`,
    );
  } catch (err) {
    const detalle = err.cause ? `${err.message}: ${err.cause}` : err.message;
    console.warn(`  ⚠ ${item.archivo}: fallo al descargar (${detalle}) [${candidato.urlImagen}] — se mantiene el placeholder SVG`);
    omitidos.push(item.archivo);
  }

  await esperar(ESPERA_MS);
}

function escribirCreditos(creditos) {
  const filas = creditos
    .map((c) => {
      const atribucion = /^(cc0|public domain|pdm)/i.test(c.licencia)
        ? "Sin atribución requerida"
        : "Atribución requerida";
      return `| ${c.archivo} | ${c.titulo} | [${c.autor}](${c.autorUrl || c.fuenteUrl}) | ${c.licencia || "—"} | [Fuente](${c.fuenteUrl}) | ${c.proveedor} | ${atribucion} |`;
    })
    .join("\n");

  const contenido = `# Créditos de imágenes

Fotos reales de repuestos y mantenimientos automotrices (genéricas, sin marca Toyota),
descargadas de fuentes de licencia abierta para el catálogo de este proyecto académico.
Generado por \`scripts/descargar-imagenes-reales.mjs\`.

| Archivo | Título | Autor | Licencia | Fuente | Proveedor | Atribución |
|---|---|---|---|---|---|---|
${filas}
`;
  writeFileSync(CREDITOS_PATH, contenido, "utf-8");
  console.log(`\n  ✓ ${path.relative(process.cwd(), CREDITOS_PATH)} (${creditos.length} filas)`);
}

async function main() {
  mkdirSync(DIR_REPUESTOS, { recursive: true });
  mkdirSync(DIR_MANTENIMIENTOS, { recursive: true });

  const usados = new Set();
  const creditos = [];
  const omitidos = [];

  console.log("Descargando fotos reales de repuestos…");
  for (const item of REPUESTOS) {
    await procesarItem(item, DIR_REPUESTOS, usados, creditos, omitidos);
  }

  console.log("Descargando fotos reales de mantenimientos…");
  for (const item of MANTENIMIENTOS) {
    await procesarItem(item, DIR_MANTENIMIENTOS, usados, creditos, omitidos);
  }

  escribirCreditos(creditos);

  const total = REPUESTOS.length + MANTENIMIENTOS.length;
  const fallosReales = omitidos.filter((a) => !EXCLUIDOS_FORZADOS.has(a));
  console.log(`\n${total - omitidos.length}/${total} descargadas, ${omitidos.length} con placeholder SVG.`);
  if (omitidos.length > 0) {
    console.log(`Con placeholder SVG: ${omitidos.join(", ")}`);
  }
  if (fallosReales.length > 0) {
    console.log(`Fallos reales de búsqueda/descarga (no intencionales): ${fallosReales.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exitCode = 1;
});
