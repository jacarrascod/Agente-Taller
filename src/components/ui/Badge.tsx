import type { HTMLAttributes } from "react";

/**
 * Insignias de estado — SPEC.md §13.1.
 * Ni el rojo ni el amarillo se usan como color de texto sobre el fondo gris
 * (4.0:1 y peor). El amarillo funciona como fondo con tinta encima.
 */
const TONOS = {
  neutro: "bg-gris-taller text-acero border border-filete",
  rojo: "bg-rojo-toyota text-white",
  verde: "bg-verde-taller text-white",
  ambar: "bg-amarillo-senal text-tinta",
  gris: "bg-gris-taller text-acero border border-filete",
};

export function Insignia({
  tono = "neutro",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tono?: keyof typeof TONOS }) {
  return (
    <span
      className={`etiqueta inline-flex items-center px-2 py-1 ${TONOS[tono]} ${className}`}
      style={{ borderRadius: 2 }}
      {...props}
    />
  );
}
