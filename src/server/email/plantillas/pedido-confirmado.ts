import { formatearPEN } from "../../lib/moneda";
import { taller } from "../../lib/taller";
import { envolverHtml, envolverTexto } from "./_layout";
import type { ModalidadEntrega, PedidoItem } from "@/types/dominio";

export interface DatosPedidoConfirmado {
  codigo: string;
  nombreCliente: string;
  items: PedidoItem[];
  montoItems: number;
  costoEnvio: number;
  subtotal: number;
  igv: number;
  total: number;
  modalidadEntrega: ModalidadEntrega;
  direccion?: string | null;
  distrito?: string | null;
  referenciaEntrega?: string | null;
}

function filaItemHtml(item: PedidoItem): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #F5F5F7;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1C1C1E;">
        ${item.nombre}<br/><span style="color:#6E6E73;font-size:11px;">${item.sku} · x${item.cantidad}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #F5F5F7;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1C1C1E;text-align:right;">
        ${formatearPEN(item.subtotal)}
      </td>
    </tr>`;
}

function filaItemTexto(item: PedidoItem): string {
  return `- ${item.nombre} (${item.sku}) x${item.cantidad} — ${formatearPEN(item.subtotal)}`;
}

export function plantillaPedidoConfirmado(datos: DatosPedidoConfirmado) {
  const asunto = `Pedido ${datos.codigo} confirmado — ${taller.nombre}`;

  const filasHtml = datos.items.map(filaItemHtml).join("");
  const tablaItemsHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;">
      ${filasHtml}
    </table>`;

  const bloqueDestacado = {
    titulo: "Resumen del pedido",
    filas: [
      { etiqueta: "Monto de ítems", valor: formatearPEN(datos.montoItems) },
      { etiqueta: "Costo de envío", valor: datos.costoEnvio === 0 ? "Gratis" : formatearPEN(datos.costoEnvio) },
      { etiqueta: "Subtotal", valor: formatearPEN(datos.subtotal) },
      { etiqueta: "IGV (18%)", valor: formatearPEN(datos.igv) },
      { etiqueta: "Total pagado", valor: formatearPEN(datos.total) },
    ],
  };

  const bloqueEntrega =
    datos.modalidadEntrega === "recojo"
      ? `<strong>Recojo en tienda:</strong> ${taller.direccion}. ${taller.referencia}. ` +
        `Horario: ${taller.horario}. Presente el código de pedido <strong>${datos.codigo}</strong> al recoger.`
      : `<strong>Delivery a domicilio:</strong> ${datos.direccion ?? ""}${datos.distrito ? `, ${datos.distrito}` : ""}, Lima. ` +
        `${datos.referenciaEntrega ? `Referencia: ${datos.referenciaEntrega}. ` : ""}` +
        `Plazo estimado de entrega: 2 a 4 días hábiles.`;

  const parrafos = [
    `Gracias por su compra en ${taller.nombre}. El pedido <strong>${datos.codigo}</strong> quedó confirmado.`,
    `<div style="background:#FFF4E5;border:1px solid #F4A100;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
       <span style="color:#8A5A00;font-size:13px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">
         Compra simulada: no se realizó ningún cobro real. Este es un proyecto académico de demostración.
       </span>
     </div>`,
    tablaItemsHtml,
    bloqueEntrega,
  ];

  const htmlContent = envolverHtml({
    preheader: `Pedido ${datos.codigo} — Total ${formatearPEN(datos.total)}`,
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos,
    bloqueDestacado,
  });

  const textContent = envolverTexto({
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos: [
      `Gracias por su compra en ${taller.nombre}. El pedido ${datos.codigo} quedó confirmado.`,
      `AVISO: Compra simulada, no se realizó ningún cobro real.`,
      "",
      "Ítems:",
      ...datos.items.map(filaItemTexto),
      "",
      datos.modalidadEntrega === "recojo"
        ? `Recojo en tienda: ${taller.direccion}. ${taller.referencia}. Horario: ${taller.horario}.`
        : `Delivery: ${datos.direccion ?? ""}${datos.distrito ? `, ${datos.distrito}` : ""}, Lima. Plazo: 2 a 4 días hábiles.`,
    ],
    bloqueDestacado,
  });

  return { asunto, htmlContent, textContent };
}
