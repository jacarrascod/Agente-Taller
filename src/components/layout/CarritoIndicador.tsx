"use client";

import { useEffect, useRef, useState } from "react";
import { leerCarrito, suscribirCambiosCarrito, totalItemsCarrito } from "@/lib/carrito";

/**
 * Contador del carrito — SPEC.md §13.6, momento 5.
 *
 * Al agregar un repuesto el dígito rota verticalmente dentro de un
 * `overflow: hidden`. Se mueve un solo elemento, no toda la barra, y solo
 * cuando el total realmente sube.
 */
export function CarritoIndicador() {
  const [total, setTotal] = useState(0);
  const [rotando, setRotando] = useState(false);
  const previo = useRef(0);

  useEffect(() => {
    const actualizar = () => {
      const nuevo = totalItemsCarrito(leerCarrito());
      setRotando(nuevo > previo.current);
      previo.current = nuevo;
      setTotal(nuevo);
    };
    actualizar();
    return suscribirCambiosCarrito(actualizar);
  }, []);

  useEffect(() => {
    if (!rotando) return;
    const t = setTimeout(() => setRotando(false), 240);
    return () => clearTimeout(t);
  }, [rotando]);

  if (total === 0) return null;

  return (
    <span
      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center overflow-hidden bg-rojo-toyota text-[10px] font-bold text-white"
      style={{ borderRadius: 2 }}
      aria-hidden="true"
    >
      <span className={rotando ? "entra" : undefined}>{total > 9 ? "9+" : total}</span>
    </span>
  );
}
