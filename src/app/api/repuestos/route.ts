import { listarRepuestos } from "@/server/services/catalogo";
import { respuestaError } from "@/server/lib/errores";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const resultado = await listarRepuestos({
      q: searchParams.get("q") ?? undefined,
      categoria: searchParams.get("categoria") ?? undefined,
      modelo: searchParams.get("modelo") ?? undefined,
      anio: searchParams.get("anio") ? Number(searchParams.get("anio")) : undefined,
      orden: (searchParams.get("orden") as "relevancia" | "precio_asc" | "precio_desc" | "nombre") ?? undefined,
      pagina: searchParams.get("pagina") ? Number(searchParams.get("pagina")) : undefined,
    });
    return Response.json(resultado);
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
