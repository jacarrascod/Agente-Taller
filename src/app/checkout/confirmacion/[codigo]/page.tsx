import { notFound } from "next/navigation";
import { Tarjeta } from "@/components/ui/Card";
import { BotonEnlace } from "@/components/ui/Button";
import { obtenerPedidoPorCodigo } from "@/server/services/pedidos";
import { formatearPEN } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ codigo: string }>;
}

export default async function PaginaConfirmacionPedido({ params }: Props) {
  const { codigo } = await params;
  const pedido = await obtenerPedidoPorCodigo(codigo);
  if (!pedido) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Tarjeta className="p-8 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-3 text-xl font-bold text-tinta">¡Pedido confirmado!</h1>
        <p className="mt-1 text-sm text-acero">
          Código <span className="font-bold text-tinta">{pedido.codigo}</span>
        </p>

        <div className="mt-6 rounded-[2px] bg-[#FFF4E5] p-3 text-xs font-bold text-[#8A5A00]">
          Compra simulada: no se realizó ningún cobro real. Este es un proyecto académico de
          demostración.
        </div>

        <div className="mt-6 space-y-2 text-left text-sm">
          {pedido.items.map((item) => (
            <div key={item.sku} className="flex justify-between text-tinta">
              <span>
                {item.nombre} × {item.cantidad}
              </span>
              <span className="font-medium">{formatearPEN(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-filete pt-4 text-left text-sm">
          <div className="flex justify-between text-acero">
            <span>Monto de ítems</span>
            <span>{formatearPEN(pedido.monto_items)}</span>
          </div>
          <div className="flex justify-between text-acero">
            <span>Costo de envío</span>
            <span>{pedido.costo_envio === 0 ? "Gratis" : formatearPEN(pedido.costo_envio)}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-tinta">
            <span>Total</span>
            <span>{formatearPEN(pedido.total)}</span>
          </div>
          <p className="text-xs text-acero">Incluye IGV: {formatearPEN(pedido.igv)}</p>
        </div>

        <p className="mt-6 text-sm text-tinta">
          {pedido.modalidad_entrega === "recojo"
            ? "Puede recoger su pedido en el taller presentando este código."
            : `Entregaremos su pedido en ${pedido.direccion}, ${pedido.distrito}. Plazo estimado: 2 a 4 días hábiles.`}
        </p>

        <BotonEnlace href="/repuestos" className="mt-8">
          Seguir comprando
        </BotonEnlace>
      </Tarjeta>
    </div>
  );
}
