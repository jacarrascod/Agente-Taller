import Link from "next/link";
import { taller, disclaimerLegal } from "@/server/lib/taller";
import { agente } from "@/lib/agente";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-filete bg-negro-motor text-white/70">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center bg-rojo-toyota text-xs font-black text-white">
              TTP
            </span>
            <span className="text-sm font-bold text-white">Toyota Taller Perú</span>
          </div>
          <p className="text-xs leading-relaxed text-white/70">{disclaimerLegal}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">Visítenos</h3>
          <p className="text-xs leading-relaxed">
            {taller.direccion}
            <br />
            {taller.referencia}
          </p>
          <a
            href={taller.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            // El rojo sobre el negro del footer da 3.9:1 y no cumple AA (SPEC.md §13.1).
            className="mt-2 inline-block text-xs font-bold text-white underline underline-offset-2 hover:text-white/80"
          >
            Ver en Google Maps
          </a>
          <p className="mt-3 text-xs">{taller.horario}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-white">Contacto</h3>
          <p className="text-xs">Tel: {taller.telefono}</p>
          <p className="text-xs">WhatsApp: {taller.whatsapp}</p>
          <nav className="mt-4 flex flex-col gap-1 text-xs">
            <Link href="/mis-citas" className="hover:text-white">
              Mis citas
            </Link>
            <Link href="/agenda" className="hover:text-white">
              Agendar mantenimiento
            </Link>
            <Link href="/chat" className="hover:text-white">
              Hablar con {agente.nombre}
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/15 px-4 py-4 text-center text-[11px] text-white/60">
        {taller.razonSocial} — Proyecto académico de demostración, Curso Agentic Engineer.
      </div>
    </footer>
  );
}
