// POST /api/checkout — Pago simulado + correo (SPEC.md §12, §14).
// El PAN completo, CVV y vencimiento NUNCA llegan aquí: solo `ultimos4`.
// Por eso este endpoint solo se invoca cuando el cliente ya validó
// (en el navegador) que la tarjeta de prueba es "aprobada".

import { crearPedido } from "@/server/services/pedidos";
import { respuestaError } from "@/server/lib/errores";
import { ipDesdeRequest, verificarRateLimit } from "@/server/lib/rate-limit";
import { zCheckout } from "@/server/lib/validacion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = ipDesdeRequest(request);
  const rateLimit = verificarRateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rateLimit.permitido) {
    return Response.json(
      { error: { codigo: "LIMITE_EXCEDIDO", mensaje: "Demasiados intentos. Intente en un minuto." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.reiniciaEnMs / 1000)) } },
    );
  }

  try {
    const body = await request.json();
    const args = zCheckout.parse(body);
    const pedido = await crearPedido(
      args.cliente,
      { modalidad: args.entrega.modalidad, direccion: args.entrega.direccion, distrito: args.entrega.distrito, referenciaEntrega: args.entrega.referenciaEntrega },
      args.items,
      args.tarjeta.ultimos4,
    );
    return Response.json({
      codigo: pedido.codigo,
      monto_items: pedido.monto_items,
      costo_envio: pedido.costo_envio,
      subtotal: pedido.subtotal,
      igv: pedido.igv,
      total: pedido.total,
      estado: pedido.estado,
      email_enviado: pedido.emailEnviado,
    });
  } catch (error) {
    const { body: errorBody, status } = respuestaError(error);
    return Response.json(errorBody, { status });
  }
}
