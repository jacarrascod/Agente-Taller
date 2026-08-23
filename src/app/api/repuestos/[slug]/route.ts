import { obtenerRepuestoPorSlug } from "@/server/services/catalogo";
import { respuestaError } from "@/server/lib/errores";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const repuesto = await obtenerRepuestoPorSlug(slug);
    if (!repuesto) {
      return Response.json(
        { error: { codigo: "REPUESTO_NO_ENCONTRADO", mensaje: `No existe el repuesto "${slug}".` } },
        { status: 404 },
      );
    }
    return Response.json(repuesto);
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
