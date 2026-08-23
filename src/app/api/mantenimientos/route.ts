import { listarMantenimientos } from "@/server/services/catalogo";
import { respuestaError } from "@/server/lib/errores";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mantenimientos = await listarMantenimientos();
    return Response.json({ items: mantenimientos });
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
