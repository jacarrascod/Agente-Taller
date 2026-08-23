/**
 * Estado de la herramienta en curso — SPEC.md §13.6, momento 2.
 *
 * Es la animación más importante del producto: convierte una espera muda en
 * una explicación de qué está haciendo el agente. El barrido de 2 px recorre
 * el borde inferior; con `prefers-reduced-motion` se congela en un filete
 * fijo y el texto sigue comunicando el estado (CA-41).
 */
export function ToolBadge({ etiqueta, listo = false }: { etiqueta: string; listo?: boolean }) {
  return (
    <div
      className={`relative flex items-center gap-2 overflow-hidden border border-filete bg-papel px-3 py-2 ${
        listo ? "" : "tool-barrido"
      }`}
      style={{ borderRadius: 2 }}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 ${listo ? "bg-verde-taller" : "bg-rojo-toyota"}`}
        style={{ borderRadius: 1 }}
      />
      <span className="dato text-[11px] text-acero">{etiqueta}</span>
    </div>
  );
}
