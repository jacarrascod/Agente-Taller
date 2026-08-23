import { Filtros } from "@/components/catalogo/Filtros";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { listarRepuestos } from "@/server/services/catalogo";
import { agente } from "@/lib/agente";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PaginaRepuestos({ searchParams }: Props) {
  const params = await searchParams;
  const resultado = await listarRepuestos({
    q: params.q,
    categoria: params.categoria,
    modelo: params.modelo,
    orden: (params.orden as "precio_asc" | "precio_desc" | "nombre") ?? "nombre",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-tinta">Catálogo de repuestos</h1>
      <div className="grid gap-8 sm:grid-cols-[220px_1fr]">
        <Filtros />
        <div>
          <p className="mb-4 text-sm text-acero">{resultado.total} resultados</p>
          {resultado.items.length === 0 ? (
            <p className="rounded-[2px] border border-filete p-8 text-center text-sm text-acero">
              No encontramos repuestos con esos filtros. Pruebe con otra búsqueda o
              pregúntele a {agente.nombre} en el chat.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {resultado.items.map((r) => (
                <ProductCard key={r.sku} producto={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
