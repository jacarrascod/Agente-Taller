"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BotonEnlace } from "@/components/ui/Button";
import { Tarjeta } from "@/components/ui/Card";
import { actualizarCantidad, leerCarrito, quitarDelCarrito, suscribirCambiosCarrito } from "@/lib/carrito";
import { formatearPEN } from "@/lib/formato";
import type { RepuestoFicha } from "@/types/dominio";

const ENVIO_GRATIS_DESDE = 300;
const ENVIO_COSTO = 15;

interface FilaCarrito {
  sku: string;
  cantidad: number;
  producto: RepuestoFicha | null;
}

export default function PaginaCarrito() {
  const [filas, setFilas] = useState<FilaCarrito[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    const items = leerCarrito();
    setCargando(true);
    const conProducto = await Promise.all(
      items.map(async (item) => {
        try {
          const respuesta = await fetch(`/api/repuestos/sku/${item.sku}`);
          const producto = respuesta.ok ? await respuesta.json() : null;
          return { sku: item.sku, cantidad: item.cantidad, producto };
        } catch {
          return { sku: item.sku, cantidad: item.cantidad, producto: null };
        }
      }),
    );
    setFilas(conProducto);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    return suscribirCambiosCarrito(cargar);
  }, []);

  const montoItems = filas.reduce((acc, f) => acc + (f.producto?.precio ?? 0) * f.cantidad, 0);
  const faltaParaEnvioGratis = Math.max(0, ENVIO_GRATIS_DESDE - montoItems);

  if (cargando) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-acero">Cargando carrito…</div>;
  }

  if (filas.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-tinta">Su carrito está vacío</p>
        <p className="mt-2 text-sm text-acero">Explore el catálogo y agregue los repuestos que necesita.</p>
        <BotonEnlace href="/repuestos" className="mt-6">
          Ver repuestos
        </BotonEnlace>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-tinta">Carrito</h1>
      <div className="space-y-4">
        {filas.map((fila) =>
          fila.producto ? (
            <Tarjeta key={fila.sku} className="flex items-center gap-4 p-4">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[2px] bg-papel">
                <Image src={fila.producto.imagen_url} alt={fila.producto.nombre} fill className="object-cover" sizes="64px" />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/repuestos/${fila.producto.slug}`} className="linea-clamp-2 text-sm font-semibold text-tinta hover:text-rojo-toyota">
                  {fila.producto.nombre}
                </Link>
                <p className="text-xs text-acero">{fila.producto.sku}</p>
              </div>
              <input
                type="number"
                min={1}
                max={20}
                value={fila.cantidad}
                onChange={(e) => actualizarCantidad(fila.sku, Number(e.target.value))}
                className="w-16 rounded-[2px] border border-filete px-2 py-1.5 text-center text-sm"
                aria-label={`Cantidad de ${fila.producto.nombre}`}
              />
              <span className="w-24 text-right text-sm font-bold text-tinta">
                {formatearPEN(fila.producto.precio * fila.cantidad)}
              </span>
              <button
                onClick={() => quitarDelCarrito(fila.sku)}
                aria-label={`Quitar ${fila.producto.nombre}`}
                className="text-acero hover:text-rojo-toyota"
              >
                ✕
              </button>
            </Tarjeta>
          ) : null,
        )}
      </div>

      <Tarjeta className="mt-8 p-6">
        {faltaParaEnvioGratis > 0 ? (
          <p className="mb-3 text-xs text-acero">
            Le faltan {formatearPEN(faltaParaEnvioGratis)} para envío gratis en delivery (desde{" "}
            {formatearPEN(ENVIO_GRATIS_DESDE)}).
          </p>
        ) : (
          <p className="mb-3 text-xs font-bold text-verde-taller">Su compra califica para delivery gratis.</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-acero">Monto de ítems</span>
          <span className="font-bold text-tinta">{formatearPEN(montoItems)}</span>
        </div>
        <p className="mt-1 text-xs text-acero">
          Envío en Lima: {faltaParaEnvioGratis > 0 ? formatearPEN(ENVIO_COSTO) : "Gratis"} · Precio de recojo en
          tienda: gratis · Incluye IGV
        </p>
        <BotonEnlace href="/checkout" className="mt-6 w-full">
          Ir a pagar
        </BotonEnlace>
      </Tarjeta>
    </div>
  );
}
