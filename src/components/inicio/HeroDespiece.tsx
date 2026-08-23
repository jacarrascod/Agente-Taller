import { BotonEnlace } from "@/components/ui/Button";
import { agente } from "@/lib/agente";

/**
 * Hero de portada — SPEC.md §13.2.
 *
 * En vez del titular centrado sobre un degradado, el hero DEMUESTRA la tesis
 * del producto: los datos son reales. El despiece con líneas guía numeradas es
 * vernáculo directo del catálogo de partes, y los cuatro rótulos son
 * exactamente las cuatro cosas que el agente sabe responder. La numeración
 * 01–04 se justifica porque son llamadas a un diagrama, donde el orden sí
 * porta información.
 *
 * El titular NO se anima: ya está pintado cuando carga la página, para no
 * castigar el LCP (§13.6).
 */

const LLAMADAS = [
  { n: "01", texto: "precio de hoy" },
  { n: "02", texto: "stock real" },
  { n: "03", texto: "compatibilidad" },
  { n: "04", texto: "rack B-02-01" },
] as const;

export function HeroDespiece() {
  return (
    <section className="border-b border-filete bg-papel">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="etiqueta text-acero">Repuestos genuinos · Técnicos certificados</p>
          <h1 className="display mt-4 max-w-xl text-4xl text-tinta sm:text-5xl lg:text-6xl">
            Repuestos que sí están en el almacén.
          </h1>
          <p className="mt-5 max-w-md text-acero">
            Pregúntele a {agente.nombre} por una pieza y le responde con el precio y el stock de
            hoy, no con un estimado.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BotonEnlace href="/repuestos" variante="primario">
              Ver repuestos
            </BotonEnlace>
            <BotonEnlace href="/agenda" variante="contorno">
              Agendar mantenimiento
            </BotonEnlace>
          </div>

          {/* En móvil el despiece no cabe legible: los mismos cuatro datos
              se listan en texto. */}
          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 lg:hidden">
            {LLAMADAS.map((l) => (
              <li key={l.n} className="flex items-baseline gap-2">
                <span className="dato text-[11px] text-rojo-toyota">{l.n}</span>
                <span className="text-sm text-acero">{l.texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <svg
            viewBox="0 0 460 340"
            width="460"
            height="340"
            role="img"
            aria-label="Despiece de un filtro de aceite con cuatro llamadas: precio de hoy, stock real, compatibilidad y ubicación en rack."
            className="reticula"
            style={{ borderRadius: 2 }}
          >
            <g
              fill="none"
              stroke="var(--tinta)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Cuerpo del filtro */}
              <ellipse cx="120" cy="108" rx="58" ry="17" />
              <path d="M62 108 V232 a58 17 0 0 0 116 0 V108" />
              {/* Pliegues del medio filtrante */}
              <path d="M86 120 V236" strokeWidth="1" opacity="0.45" />
              <path d="M107 124 V241" strokeWidth="1" opacity="0.45" />
              <path d="M133 124 V241" strokeWidth="1" opacity="0.45" />
              <path d="M154 120 V236" strokeWidth="1" opacity="0.45" />
              {/* Rosca inferior */}
              <path d="M96 258 h48 M100 268 h40" strokeWidth="1.5" opacity="0.7" />
            </g>

            {/* Líneas guía: se dibujan con stroke-dashoffset (§13.6, momento 1) */}
            <g fill="none" stroke="var(--rojo-toyota)" strokeWidth="1.5">
              <path className="trazo-guia" d="M178 100 H236 V56 H262" style={{ animationDelay: "120ms" }} />
              <path className="trazo-guia" d="M178 150 H248 V128 H262" style={{ animationDelay: "190ms" }} />
              <path className="trazo-guia" d="M178 205 H248 V200 H262" style={{ animationDelay: "260ms" }} />
              <path className="trazo-guia" d="M150 262 H236 V272 H262" style={{ animationDelay: "330ms" }} />
            </g>

            {/* Rótulos */}
            {LLAMADAS.map((l, i) => (
              <g key={l.n} className="entra" style={{ animationDelay: `${400 + i * 70}ms` }}>
                <text
                  x="272"
                  y={56 + i * 72}
                  fill="var(--rojo-toyota)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}
                >
                  {l.n}
                </text>
                <text
                  x="298"
                  y={56 + i * 72}
                  fill="var(--tinta)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                >
                  {l.texto}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
