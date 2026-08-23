import { type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import Link from "next/link";

// Radio de 2 px, coherente con la ficha. El rojo solo aparece relleno con
// texto blanco encima (4.6:1, AA); nunca como color de texto. SPEC.md §13.1
const BASE =
  "inline-flex items-center justify-center gap-2 text-sm font-semibold transition-colors duration-[var(--dur-micro)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta disabled:opacity-50 disabled:pointer-events-none";

const VARIANTES = {
  primario: "bg-rojo-toyota text-white hover:bg-rojo-oscuro px-5 py-2.5",
  secundario: "bg-negro-motor text-white hover:bg-tinta px-5 py-2.5",
  contorno: "border border-tinta text-tinta hover:bg-tinta hover:text-white px-5 py-2.5 bg-transparent",
  fantasma: "text-tinta hover:bg-papel px-4 py-2",
};

export type VarianteBoton = keyof typeof VARIANTES;

interface PropsComunes {
  variante?: VarianteBoton;
  className?: string;
}

type PropsBoton = PropsComunes & ButtonHTMLAttributes<HTMLButtonElement>;
type PropsEnlace = PropsComunes & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Boton({ variante = "primario", className = "", ...props }: PropsBoton) {
  return (
    <button className={`${BASE} ${VARIANTES[variante]} ${className}`} style={{ borderRadius: 2 }} {...props} />
  );
}

export function BotonEnlace({ variante = "primario", className = "", href, ...props }: PropsEnlace) {
  return (
    <Link
      href={href}
      className={`${BASE} ${VARIANTES[variante]} ${className}`}
      style={{ borderRadius: 2 }}
      {...props}
    />
  );
}
