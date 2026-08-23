// POST crea una cita (mismo servicio que la tool agendar_cita).
// GET ?email= consulta las citas del cliente (mismo servicio que consultar_citas).
// Rate limit estricto en GET: es la única vía de "enumeración por email" (SPEC.md §15).

import { agendarCita } from "@/server/services/agenda";
import { consultarCitasFormateadas } from "@/server/services/citas";
import { respuestaError } from "@/server/lib/errores";
import { ipDesdeRequest, limites, verificarRateLimit } from "@/server/lib/rate-limit";
import { zAgendarCita, zConsultarCitas } from "@/server/lib/validacion";
import { taller } from "@/server/lib/taller";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = ipDesdeRequest(request);
  const rateLimit = verificarRateLimit(`agendar:${ip}`, limites.agendarPorHora, 60 * 60_000);
  if (!rateLimit.permitido) {
    return Response.json(
      { error: { codigo: "LIMITE_EXCEDIDO", mensaje: "Demasiadas citas agendadas desde este origen. Intente más tarde." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.reiniciaEnMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const args = zAgendarCita.parse(body);
    const resultado = await agendarCita({
      inicioIso: args.inicio_iso,
      mantenimientoSlug: args.mantenimiento_slug,
      nombreCliente: args.nombre_cliente,
      email: args.email,
      telefono: args.telefono,
      modeloVehiculo: args.modelo_vehiculo,
      anioVehiculo: args.anio_vehiculo,
      placa: args.placa,
      notas: args.notas,
      origen: "web",
    });

    if (!resultado.ok) {
      return Response.json(
        { error: { codigo: "SLOT_OCUPADO", mensaje: "Ese horario ya no está disponible.", detalle: { alternativas: resultado.alternativas } } },
        { status: 409 },
      );
    }

    return Response.json({
      codigo: resultado.codigo,
      inicio: args.inicio_iso,
      servicio: resultado.servicio,
      precio: resultado.precio,
      email_enviado: resultado.emailEnviado,
      direccion: taller.direccion,
    });
  } catch (error) {
    const { body: errorBody, status } = respuestaError(error);
    return Response.json(errorBody, { status });
  }
}

export async function GET(request: Request) {
  const ip = ipDesdeRequest(request);
  const rateLimit = verificarRateLimit(`citas:${ip}`, limites.citasPorMinuto, 60_000);
  if (!rateLimit.permitido) {
    return Response.json(
      { error: { codigo: "LIMITE_EXCEDIDO", mensaje: "Demasiadas consultas. Intente en un minuto." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.reiniciaEnMs / 1000)) } },
    );
  }

  const { searchParams } = new URL(request.url);
  try {
    const args = zConsultarCitas.parse({
      email: searchParams.get("email") ?? "",
      incluir_pasadas: searchParams.get("incluir_pasadas") === "true",
    });
    const resultado = await consultarCitasFormateadas(args.email, args.incluir_pasadas ?? true);
    return Response.json(resultado);
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
