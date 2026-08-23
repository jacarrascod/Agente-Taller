import type { HTMLAttributes } from "react";

/**
 * Ficha de orden de trabajo — SPEC.md §13.1.
 * Radio de 2 px y filete de 1 px: es una ficha impresa, no una tarjeta de
 * aplicación. Sin sombras difusas; la separación la da el fondo gris.
 */
export function Tarjeta({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`border border-filete bg-papel ${className}`} style={{ borderRadius: 2 }} {...props} />;
}

/** Variante con la esquina recortada. Se reserva para las fichas de catálogo,
 *  cita y servicio: es el único gesto decorativo del sistema. */
export function Ficha({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ficha ${className}`} {...props} />;
}

/** Banda negra superior: categoría a la izquierda, identificador a la derecha. */
export function FichaBanda({
  etiqueta,
  dato,
}: {
  etiqueta: string;
  dato?: string;
}) {
  // El identificador nunca se parte en dos líneas: es el ancla visual de la
  // ficha. Si falta espacio, se recorta la categoría, no el dato.
  return (
    <div className="ficha-banda h-8">
      <span className="etiqueta min-w-0 truncate">{etiqueta}</span>
      {dato ? (
        <span className="dato shrink-0 whitespace-nowrap text-[11px] text-white/80">{dato}</span>
      ) : null}
    </div>
  );
}
