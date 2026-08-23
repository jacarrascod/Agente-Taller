import { cancelarCita } from "@/server/services/citas";
import { respuestaError } from "@/server/lib/errores";
import { ipDesdeRequest, verificarRateLimit } from "@/server/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const zBody = z.object({ email: z.string().email(), motivo: z.string().max(300).optional() });

export async function POST(request: Request, context: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await context.params;
  const ip = ipDesdeRequest(request);
  const rateLimit = verificarRateLimit(`cancelar:${ip}`, 3, 60_000);
  if (!rateLimit.permitido) {
    return Response.json(
      { error: { codigo: "LIMITE_EXCEDIDO", mensaje: "Demasiados intentos. Intente en un minuto." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.reiniciaEnMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const { email, motivo } = zBody.parse(body);
    const resultado = await cancelarCita(codigo, email, motivo);
    return Response.json({
      ok: true,
      codigo: resultado.codigo,
      fecha_legible: resultado.fechaLegible,
      hora: resultado.hora,
      servicio: resultado.servicio,
      email_enviado: resultado.emailEnviado,
    });
  } catch (error) {
    const { body: errorBody, status } = respuestaError(error);
    return Response.json(errorBody, { status });
  }
}
