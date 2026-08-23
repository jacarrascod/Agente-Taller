import Link from "next/link";
import { CarritoIndicador } from "./CarritoIndicador";

const ENLACES = [
  { href: "/repuestos", label: "Repuestos" },
  { href: "/mantenimientos", label: "Mantenimientos" },
  { href: "/agenda", label: "Agenda" },
  { href: "/mis-citas", label: "Mis citas" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-filete bg-gris-taller/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="display flex h-8 w-8 items-center justify-center bg-rojo-toyota text-[13px] text-white"
            style={{ borderRadius: 2 }}
          >
            TTP
          </span>
          <span className="etiqueta hidden text-tinta sm:inline">Toyota Taller Perú</span>
        </Link>
        {/* La nav desborda a 360 px con 4 enlaces más el carrito. Se desplaza
            dentro de su propio contenedor para que la PÁGINA nunca tenga
            scroll horizontal (CA-30), en vez de recortar enlaces. */}
        <nav className="flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-x-auto sm:gap-1">
          {ENLACES.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="shrink-0 whitespace-nowrap px-2 py-2 text-sm font-medium text-acero transition-colors duration-[var(--dur-micro)] hover:text-tinta sm:px-3"
            >
              {enlace.label}
            </Link>
          ))}
          <Link
            href="/carrito"
            aria-label="Ver carrito"
            className="relative ml-1 shrink-0 whitespace-nowrap border border-filete px-3 py-2 text-sm font-medium text-tinta transition-colors duration-[var(--dur-micro)] hover:bg-papel"
            style={{ borderRadius: 2 }}
          >
            Carrito
            <CarritoIndicador />
          </Link>
        </nav>
      </div>
    </header>
  );
}
