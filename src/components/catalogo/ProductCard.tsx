import Image from "next/image";
import Link from "next/link";
import { Ficha, FichaBanda } from "../ui/Card";
import { StockBadge } from "./StockBadge";
import { formatearPEN } from "@/lib/formato";
import type { EstadoStock } from "@/types/dominio";

export interface DatosTarjetaProducto {
  slug: string;
  sku?: string;
  categoria?: string;
  nombre: string;
  precio: number;
  imagen_url: string;
  estado_stock: EstadoStock;
}

/**
 * Ficha de repuesto — SPEC.md §13.1.
 * Banda negra con categoría y SKU, dibujo, y tira de datos al pie. El SKU va
 * en monoespaciada como todo identificador del sistema (CA-44).
 */
export function ProductCard({ producto }: { producto: DatosTarjetaProducto }) {
  return (
    <Ficha className="group flex h-full flex-col overflow-hidden">
      <FichaBanda etiqueta={producto.categoria ?? "Repuesto"} dato={producto.sku} />
      <Link href={`/repuestos/${producto.slug}`} className="block">
        <div className="reticula relative aspect-[4/3] w-full">
          <Image
            src={producto.imagen_url}
            alt={producto.nombre}
            fill
            className="object-contain p-3 transition-transform duration-[var(--dur-elem)] group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
      </Link>
      {/* min-h de dos líneas: mantiene alineadas las tiras de datos de toda
          la fila aunque los nombres midan distinto. */}
      <div className="flex flex-1 flex-col p-3">
        <Link href={`/repuestos/${producto.slug}`}>
          <h3 className="linea-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-tinta group-hover:underline">
            {producto.nombre}
          </h3>
        </Link>
      </div>
      {/* En móvil la tira va apilada: a dos columnas la insignia de stock no
          entra en ~80 px y quedaba recortada por el overflow de la ficha. */}
      <div className="ficha-datos grid-cols-1 sm:grid-cols-2">
        <div>
          {/* Nunca se parte: un precio en dos líneas rompe la alineación de la
              tira de datos en toda la fila. */}
          <span className="display block whitespace-nowrap text-[15px] text-tinta">
            {formatearPEN(producto.precio)}
          </span>
          <span className="etiqueta text-acero">Precio</span>
        </div>
        <div className="flex items-center">
          <StockBadge estado={producto.estado_stock} />
        </div>
      </div>
    </Ficha>
  );
}
