// Endpoint auxiliar para hidratar el carrito (localStorage solo guarda SKU
// + cantidad, ver SPEC.md S5). No está en la tabla de §12 porque no lo usa
// el agente; es soporte de UI sobre el mismo servicio de catálogo.

import { obtenerRepuestoPorSku } from "@/server/services/catalogo";
import { respuestaError } from "@/server/lib/errores";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ sku: string }> }) {
  const { sku } = await context.params;
  try {
    const repuesto = await obtenerRepuestoPorSku(sku);
    if (!repuesto) {
      return Response.json({ error: { codigo: "REPUESTO_NO_ENCONTRADO", mensaje: `No existe el SKU "${sku}".` } }, { status: 404 });
    }
    return Response.json(repuesto);
  } catch (error) {
    const { body, status } = respuestaError(error);
    return Response.json(body, { status });
  }
}
