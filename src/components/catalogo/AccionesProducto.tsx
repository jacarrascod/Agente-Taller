"use client";

import { useState } from "react";
import { Boton } from "../ui/Button";
import { agregarAlCarrito } from "@/lib/carrito";
import { abrirChatConTexto } from "@/lib/chat-eventos";
import { agente } from "@/lib/agente";

export function AccionesProducto({
  sku,
  nombre,
  agotado,
}: {
  sku: string;
  nombre: string;
  agotado: boolean;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="cantidad" className="text-sm font-bold text-tinta">
          Cantidad
        </label>
        <div className="flex items-center rounded-[2px] border border-filete">
          <button
            type="button"
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className="px-3 py-1.5 text-lg text-tinta hover:bg-papel"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <input
            id="cantidad"
            value={cantidad}
            readOnly
            className="w-10 border-x border-filete py-1.5 text-center text-sm"
          />
          <button
            type="button"
            onClick={() => setCantidad((c) => Math.min(20, c + 1))}
            className="px-3 py-1.5 text-lg text-tinta hover:bg-papel"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Boton
          disabled={agotado}
          onClick={() => {
            agregarAlCarrito(sku, cantidad);
            setAgregado(true);
            setTimeout(() => setAgregado(false), 2000);
          }}
        >
          {agotado ? "Agotado" : agregado ? "Agregado ✓" : "Agregar al carrito"}
        </Boton>
        <Boton
          variante="contorno"
          onClick={() => abrirChatConTexto(`Tengo una consulta sobre ${nombre} (SKU ${sku})`)}
        >
          Consultar a {agente.nombre}
        </Boton>
      </div>
    </div>
  );
}
