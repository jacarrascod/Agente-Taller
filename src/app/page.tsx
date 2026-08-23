import Link from "next/link";
import { BotonEnlace } from "@/components/ui/Button";
import { Ficha, FichaBanda } from "@/components/ui/Card";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { HeroDespiece } from "@/components/inicio/HeroDespiece";
import { listarMantenimientos, listarRepuestos } from "@/server/services/catalogo";
import { formatearPEN } from "@/lib/formato";
import { agente } from "@/lib/agente";

export const dynamic = "force-dynamic";

const CONFIANZA = [
  { titulo: "Garantía de 12 meses", detalle: "En todos los repuestos genuinos" },
  { titulo: "Repuestos genuinos", detalle: "Toyota Genuine Parts y marcas OEM" },
  { titulo: "Técnicos certificados", detalle: "Diagnóstico computarizado incluido" },
];

export default async function PaginaInicio() {
  const [mantenimientos, catalogo] = await Promise.all([
    listarMantenimientos(),
    listarRepuestos({ orden: "nombre", porPagina: 60 }),
  ]);
  const destacados = catalogo.items.slice(0, 4);

  return (
    <div>
      <HeroDespiece />

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="display text-2xl text-tinta">Mantenimientos del taller</h2>
          <Link href="/mantenimientos" className="text-sm font-semibold text-tinta hover:underline">
            Ver el detalle →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {mantenimientos.map((m, i) => (
            <Ficha key={m.slug} className="flex flex-col">
              <FichaBanda
                etiqueta={`Servicio ${String(i + 1).padStart(2, "0")}`}
                dato={m.intervalo_km ? `${m.intervalo_km.toLocaleString("es-PE")} km` : undefined}
              />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-lg text-tinta">{m.nombre}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-acero">{m.descripcion}</p>
                <Link
                  href={`/agenda?servicio=${m.slug}`}
                  className="mt-5 text-sm font-semibold text-tinta hover:underline"
                >
                  Agendar →
                </Link>
              </div>
              <div className="ficha-datos grid-cols-2">
                <div>
                  <span className="display block text-lg text-tinta">
                    {formatearPEN(m.precio)}
                  </span>
                  <span className="etiqueta text-acero">Precio</span>
                </div>
                <div>
                  <span className="dato block text-lg text-tinta">{m.duracion_minutos} min</span>
                  <span className="etiqueta text-acero">Duración</span>
                </div>
              </div>
            </Ficha>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="display text-2xl text-tinta">Repuestos destacados</h2>
          <Link href="/repuestos" className="text-sm font-semibold text-tinta hover:underline">
            Ver todo el catálogo →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {destacados.map((r) => (
            <ProductCard key={r.sku} producto={r} />
          ))}
        </div>
      </section>

      {/* Banda del agente: se presenta por lo que sabe responder, no por su
          tecnología. SPEC.md §9.1 */}
      <section className="bg-negro-motor">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="etiqueta text-white/60">Asesor del taller</p>
            <h2 className="display mt-3 text-3xl text-white">Pregúntele a {agente.nombre}</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
              Le dice si la pieza está en almacén y cuánto cuesta, le busca un horario libre para su
              mantenimiento y le responde qué le toca a su Toyota según el kilometraje.
            </p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-3">
              {[
                "¿Tienen filtro de aceite para Corolla?",
                "Quiero agendar un mantenimiento",
                "¿Cuándo es mi cita?",
              ].map((ejemplo) => (
                <li
                  key={ejemplo}
                  className="border border-white/15 px-3 py-2 text-xs text-white/70"
                  style={{ borderRadius: 2 }}
                >
                  {ejemplo}
                </li>
              ))}
            </ul>
          </div>
          <BotonEnlace href="/chat" variante="primario">
            Abrir el chat
          </BotonEnlace>
        </div>
      </section>

      <section className="border-t border-filete bg-papel">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          {CONFIANZA.map((c) => (
            <div key={c.titulo}>
              <p className="display text-base text-tinta">{c.titulo}</p>
              <p className="mt-1 text-sm text-acero">{c.detalle}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
