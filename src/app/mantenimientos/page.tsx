import { BotonEnlace } from "@/components/ui/Button";
import { Tarjeta } from "@/components/ui/Card";
import { listarMantenimientos } from "@/server/services/catalogo";
import { formatearPEN } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function PaginaMantenimientos() {
  const mantenimientos = await listarMantenimientos();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-tinta">Mantenimientos</h1>
      <p className="mt-2 max-w-2xl text-sm text-acero">
        Los 3 servicios que ofrece el taller. Cada atención dura exactamente 1 hora y se agenda
        de lunes a viernes, de 09:00 a 17:00.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {mantenimientos.map((m) => (
          <Tarjeta key={m.slug} className="flex flex-col p-6">
            <h2 className="text-lg font-bold text-tinta">{m.nombre}</h2>
            <p className="mt-2 text-sm text-acero">{m.descripcion}</p>
            <div className="mt-4">
              <span className="text-3xl font-black text-tinta">{formatearPEN(m.precio)}</span>
              <p className="text-xs text-acero">
                {m.duracion_minutos} minutos
                {m.intervalo_km ? ` · cada ${m.intervalo_km.toLocaleString("es-PE")} km` : ""}
              </p>
            </div>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-tinta">
              {m.incluye.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-verde-taller">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <BotonEnlace href={`/agenda?servicio=${m.slug}`} className="mt-6">
              Agendar
            </BotonEnlace>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}
