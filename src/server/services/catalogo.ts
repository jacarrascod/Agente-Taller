// Catálogo de repuestos y mantenimientos. Única fuente de lógica de
// negocio; las tools del agente y los endpoints REST son dos fachadas
// sobre este mismo servicio (SPEC.md §4, "principio rector").

import "server-only";
import { supabaseAdmin } from "../integrations/supabase";
import { ErrorAplicacion } from "../lib/errores";
import type { EstadoStock, Mantenimiento, RepuestoBusqueda, RepuestoFicha } from "@/types/dominio";

export interface FiltrosBusquedaRepuestos {
  consulta?: string;
  modelo?: string;
  anio?: number;
  categoria?: string;
  limite?: number;
}

export async function buscarRepuestos(filtros: FiltrosBusquedaRepuestos): Promise<RepuestoBusqueda[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("buscar_repuestos", {
    p_consulta: filtros.consulta ?? null,
    p_modelo: filtros.modelo ?? null,
    p_anio: filtros.anio ?? null,
    p_categoria: filtros.categoria ?? null,
    p_limite: filtros.limite ?? 8,
  });
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al buscar repuestos: ${error.message}`, 500);

  return (data ?? []).map((fila) => ({
    id: fila.id,
    sku: fila.sku,
    slug: fila.slug,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    precio: Number(fila.precio),
    imagen_url: fila.imagen_url,
    stock_disponible: fila.stock_disponible,
    estado_stock: fila.estado_stock as EstadoStock,
    compatibilidad: fila.compatibilidad ?? [],
    relevancia: fila.relevancia,
  }));
}

/**
 * Palanca de desambiguación (SPEC.md §9.4, T1): detecta cuándo el
 * resultado de una búsqueda es ambiguo para que el agente repregunte en
 * vez de adivinar. Se considera ambiguo cuando hay más de 3 resultados,
 * o cuando aparecen variantes de eje/posición sin que el cliente haya
 * precisado (delantero/trasero/izquierdo/derecho) mezcladas entre sí.
 */
export function evaluarAmbiguedad(
  resultados: RepuestoBusqueda[],
  filtros: FiltrosBusquedaRepuestos,
): string | null {
  if (resultados.length === 0) return null;
  if (resultados.length > 3) {
    return "Hay más de 3 resultados. Pregunta por el modelo, el año o precisa qué pieza exacta busca antes de cotizar.";
  }
  const posiciones = ["delantero", "delantera", "trasero", "trasera", "izquierdo", "izquierda", "derecho", "derecha"];
  const nombresLower = resultados.map((r) => r.nombre.toLowerCase());
  const tienePosicionVariada =
    posiciones.some((p) => nombresLower.some((n) => n.includes(p))) &&
    new Set(nombresLower.map((n) => posiciones.find((p) => n.includes(p)) ?? "")).size > 1;
  if (tienePosicionVariada) {
    return "Hay resultados de distinto eje o posición. Pregunta si es delantero/trasero (o izquierdo/derecho) antes de cotizar.";
  }
  if (!filtros.modelo && resultados.length > 1) {
    return "El cliente no indicó el modelo de su Toyota. Si hace falta para precisar compatibilidad, pregúntale.";
  }
  return null;
}

export async function obtenerRepuestoPorSku(sku: string): Promise<RepuestoFicha | null> {
  return obtenerRepuestoFicha({ sku });
}

export async function obtenerRepuestoPorSlug(slug: string): Promise<RepuestoFicha | null> {
  return obtenerRepuestoFicha({ slug });
}

async function obtenerRepuestoFicha(clave: { sku?: string; slug?: string }): Promise<RepuestoFicha | null> {
  const db = supabaseAdmin();
  let query = db
    .from("repuestos")
    .select(
      "id, sku, slug, nombre, descripcion, numero_parte, marca_repuesto, precio, moneda, imagen_url, garantia_meses, especificaciones, destacado, categorias(nombre, slug)",
    )
    .eq("activo", true);

  query = clave.sku ? query.eq("sku", clave.sku) : query.eq("slug", clave.slug!);

  const { data: repuesto, error } = await query.maybeSingle();
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al obtener repuesto: ${error.message}`, 500);
  if (!repuesto) return null;

  const [{ data: inventario }, { data: compatibilidad }] = await Promise.all([
    db.from("inventario").select("stock_disponible, dias_reposicion, ubicacion").eq("repuesto_id", repuesto.id).maybeSingle(),
    db
      .from("repuesto_compatibilidad")
      .select("anio_desde, anio_hasta, modelos_toyota(nombre)")
      .eq("repuesto_id", repuesto.id),
  ]);

  const stockDisponible = inventario?.stock_disponible ?? 0;
  const estadoStock: EstadoStock =
    stockDisponible === 0 ? "agotado" : stockDisponible <= 2 ? "ultimas_unidades" : "disponible";

  const categoriaRelacion = repuesto.categorias as unknown as { nombre: string; slug: string } | null;

  return {
    id: repuesto.id,
    sku: repuesto.sku,
    slug: repuesto.slug,
    nombre: repuesto.nombre,
    descripcion: repuesto.descripcion,
    categoria: categoriaRelacion?.nombre ?? "",
    categoria_slug: categoriaRelacion?.slug ?? "",
    numero_parte: repuesto.numero_parte,
    marca_repuesto: repuesto.marca_repuesto,
    precio: Number(repuesto.precio),
    moneda: repuesto.moneda,
    imagen_url: repuesto.imagen_url,
    garantia_meses: repuesto.garantia_meses,
    especificaciones: repuesto.especificaciones as Record<string, unknown>,
    destacado: repuesto.destacado,
    stock_disponible: stockDisponible,
    estado_stock: estadoStock,
    dias_reposicion: inventario?.dias_reposicion ?? 7,
    ubicacion_publica: inventario?.ubicacion ? inventario.ubicacion.split("-")[0] : null,
    compatibilidad: (compatibilidad ?? []).map((c) => ({
      modelo: (c.modelos_toyota as unknown as { nombre: string } | null)?.nombre ?? "",
      anio_desde: c.anio_desde,
      anio_hasta: c.anio_hasta,
    })),
  };
}

export interface FiltrosListadoRepuestos {
  q?: string;
  categoria?: string;
  modelo?: string;
  anio?: number;
  orden?: "relevancia" | "precio_asc" | "precio_desc" | "nombre";
  pagina?: number;
  porPagina?: number;
}

export async function listarRepuestos(filtros: FiltrosListadoRepuestos) {
  const pagina = filtros.pagina ?? 1;
  const porPagina = filtros.porPagina ?? 24;

  // La búsqueda relevante usa la función SQL (full-text + trigramas);
  // el listado simple de catálogo usa una consulta directa paginada.
  if (filtros.q || filtros.modelo || filtros.anio) {
    const resultados = await buscarRepuestos({
      consulta: filtros.q,
      modelo: filtros.modelo,
      anio: filtros.anio,
      categoria: filtros.categoria,
      limite: 20,
    });
    return { items: resultados, total: resultados.length, pagina: 1 };
  }

  const db = supabaseAdmin();
  // El embed de categorías necesita el hint `!inner` para que PostgREST
  // aplique el .eq() sobre él como filtro de las filas de repuestos y no
  // lo ignore silenciosamente (sin `!inner` solo daría forma al JSON de
  // salida, nunca filtraría).
  const relacionCategoria = filtros.categoria ? "categorias!inner(nombre, slug)" : "categorias(nombre, slug)";
  let query = db
    .from("repuestos")
    .select(`id, sku, slug, nombre, descripcion, precio, imagen_url, ${relacionCategoria}`, {
      count: "exact",
    })
    .eq("activo", true);

  if (filtros.categoria) query = query.eq("categorias.slug", filtros.categoria);

  const orden = filtros.orden ?? "nombre";
  if (orden === "precio_asc") query = query.order("precio", { ascending: true });
  else if (orden === "precio_desc") query = query.order("precio", { ascending: false });
  else query = query.order("nombre", { ascending: true });

  const desde = (pagina - 1) * porPagina;
  query = query.range(desde, desde + porPagina - 1);

  const { data, count, error } = await query;
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al listar repuestos: ${error.message}`, 500);

  const ids = (data ?? []).map((r) => r.id);
  const { data: inventarios } = ids.length
    ? await db.from("inventario").select("repuesto_id, stock_disponible").in("repuesto_id", ids)
    : { data: [] as { repuesto_id: string; stock_disponible: number }[] };
  const stockPorId = new Map((inventarios ?? []).map((i) => [i.repuesto_id, i.stock_disponible]));

  const items = (data ?? []).map((r) => {
    const stockDisponible = stockPorId.get(r.id) ?? 0;
    const estadoStock: EstadoStock =
      stockDisponible === 0 ? "agotado" : stockDisponible <= 2 ? "ultimas_unidades" : "disponible";
    const categoriaRelacion = r.categorias as unknown as { nombre: string; slug: string } | null;
    return {
      id: r.id,
      sku: r.sku,
      slug: r.slug,
      nombre: r.nombre,
      descripcion: r.descripcion,
      categoria: categoriaRelacion?.nombre ?? "",
      precio: Number(r.precio),
      imagen_url: r.imagen_url,
      stock_disponible: stockDisponible,
      estado_stock: estadoStock,
      compatibilidad: [] as string[],
      relevancia: 1,
    };
  });

  return { items, total: count ?? items.length, pagina };
}

export async function listarMantenimientos(): Promise<Mantenimiento[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("mantenimientos")
    .select("id, slug, nombre, descripcion, duracion_minutos, precio, intervalo_km, incluye, imagen_url, orden")
    .eq("activo", true)
    .order("orden", { ascending: true });
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al listar mantenimientos: ${error.message}`, 500);
  return (data ?? []).map((m) => ({ ...m, precio: Number(m.precio) }));
}

export async function obtenerMantenimientoPorSlug(slug: string): Promise<Mantenimiento | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("mantenimientos")
    .select("id, slug, nombre, descripcion, duracion_minutos, precio, intervalo_km, incluye, imagen_url, orden")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new ErrorAplicacion("ERROR_DESCONOCIDO", `Fallo al obtener mantenimiento: ${error.message}`, 500);
  if (!data) return null;
  return { ...data, precio: Number(data.precio) };
}
