import { consultarDisponibilidad } from "@/server/services/agenda";
import { respuestaError } from "@/server/lib/errores";
import { zConsultarDisponibilidadAgenda } from "@/server/lib/validacion";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const args = zConsultarDisponibilidadAgenda.parse({
      fecha: searchParams.get("fecha") ?? "",
      fecha_hasta: searchParams.get("fecha_hasta") ?? undefined,
    });
    const resultado = await consultarDisponibilidad(args.fecha, args.fecha_hasta);
    return Response.json(resultado);
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
