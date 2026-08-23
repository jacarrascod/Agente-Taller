"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CATEGORIAS = [
  { slug: "filtros", nombre: "Filtros" },
  { slug: "frenos", nombre: "Frenos" },
  { slug: "motor", nombre: "Motor" },
  { slug: "suspension", nombre: "Suspensión" },
  { slug: "electrico", nombre: "Sistema eléctrico" },
  { slug: "lubricantes", nombre: "Lubricantes" },
  { slug: "transmision", nombre: "Transmisión" },
  { slug: "accesorios", nombre: "Accesorios" },
];

const MODELOS = [
  "Corolla",
  "Yaris",
  "Hilux",
  "RAV4",
  "Fortuner",
  "Prius",
  "Camry",
  "Land Cruiser",
  "Rush",
  "Avanza",
];

export function Filtros() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const primerRender = useRef(true);

  const actualizarParam = useCallback(
    (clave: string, valor: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor) params.set(clave, valor);
      else params.delete(clave);
      router.push(`/repuestos?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const temporizador = setTimeout(() => actualizarParam("q", q), 350);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <aside className="space-y-6">
      <div>
        <label htmlFor="buscador" className="mb-1 block text-sm font-bold text-tinta">
          Buscar
        </label>
        <input
          id="buscador"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej: filtro de aceite"
          className="w-full rounded-[2px] border border-filete px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo-toyota"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-tinta">Categoría</p>
        <div className="space-y-1">
          <button
            onClick={() => actualizarParam("categoria", "")}
            className={`block w-full rounded-[2px] px-2 py-1.5 text-left text-sm ${!searchParams.get("categoria") ? "bg-papel font-bold text-tinta" : "text-acero hover:bg-papel"}`}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.slug}
              onClick={() => actualizarParam("categoria", c.slug)}
              className={`block w-full rounded-[2px] px-2 py-1.5 text-left text-sm ${searchParams.get("categoria") === c.slug ? "bg-papel font-bold text-tinta" : "text-acero hover:bg-papel"}`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="modelo" className="mb-1 block text-sm font-bold text-tinta">
          Modelo
        </label>
        <select
          id="modelo"
          value={searchParams.get("modelo") ?? ""}
          onChange={(e) => actualizarParam("modelo", e.target.value)}
          className="w-full rounded-[2px] border border-filete px-3 py-2 text-sm"
        >
          <option value="">Todos los modelos</option>
          {MODELOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="orden" className="mb-1 block text-sm font-bold text-tinta">
          Ordenar por
        </label>
        <select
          id="orden"
          value={searchParams.get("orden") ?? "nombre"}
          onChange={(e) => actualizarParam("orden", e.target.value)}
          className="w-full rounded-[2px] border border-filete px-3 py-2 text-sm"
        >
          <option value="nombre">Nombre</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
      </div>
    </aside>
  );
}
