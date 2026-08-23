import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StockBadge } from "@/components/catalogo/StockBadge";
import { AccionesProducto } from "@/components/catalogo/AccionesProducto";
import { Insignia } from "@/components/ui/Badge";
import { obtenerRepuestoPorSlug } from "@/server/services/catalogo";
import { formatearPEN } from "@/lib/formato";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PaginaRepuesto({ params }: Props) {
  const { slug } = await params;
  const repuesto = await obtenerRepuestoPorSlug(slug);
  if (!repuesto) notFound();

  const especificaciones = Object.entries(repuesto.especificaciones);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-xs text-acero">
        <Link href="/repuestos" className="hover:text-rojo-toyota">
          Repuestos
        </Link>{" "}
        / {repuesto.categoria} / <span className="text-tinta">{repuesto.nombre}</span>
      </nav>

      <div className="grid gap-10 sm:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px] bg-papel">
          <Image
            src={repuesto.imagen_url}
            alt={repuesto.nombre}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
            priority
          />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-acero">{repuesto.marca_repuesto}</p>
          <h1 className="mt-1 text-2xl font-bold text-tinta">{repuesto.nombre}</h1>
          <p className="mt-2 text-sm text-acero">
            SKU: {repuesto.sku}
            {repuesto.numero_parte ? ` · Número de parte: ${repuesto.numero_parte}` : ""}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl font-black text-tinta">{formatearPEN(repuesto.precio)}</span>
            <StockBadge estado={repuesto.estado_stock} />
          </div>
          {repuesto.estado_stock === "agotado" ? (
            <p className="mt-1 text-sm text-acero">
              Reposición estimada en {repuesto.dias_reposicion} días hábiles.
            </p>
          ) : null}
          <p className="mt-1 text-sm text-acero">Garantía: {repuesto.garantia_meses} meses.</p>

          <p className="mt-4 text-sm leading-relaxed text-tinta">{repuesto.descripcion}</p>

          <div className="mt-6">
            <AccionesProducto sku={repuesto.sku} nombre={repuesto.nombre} agotado={repuesto.estado_stock === "agotado"} />
          </div>

          {repuesto.compatibilidad.length > 0 ? (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-bold text-tinta">Compatible con</h2>
              <div className="flex flex-wrap gap-2">
                {repuesto.compatibilidad.map((c, i) => (
                  <Insignia key={i} tono="neutro">
                    {c.modelo}
                    {c.anio_desde ? ` (${c.anio_desde}${c.anio_hasta ? `–${c.anio_hasta}` : "+"})` : ""}
                  </Insignia>
                ))}
              </div>
            </div>
          ) : null}

          {especificaciones.length > 0 ? (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-bold text-tinta">Especificaciones</h2>
              <table className="w-full overflow-hidden rounded-[2px] border border-filete text-sm">
                <tbody>
                  {especificaciones.map(([clave, valor]) => (
                    <tr key={clave} className="border-b border-filete last:border-0">
                      <td className="bg-papel px-3 py-2 font-medium capitalize text-tinta">
                        {clave.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-tinta">{String(valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
