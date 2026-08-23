import type { DiaAgenda, SlotAgenda } from "@/types/dominio";

/**
 * Grilla de horarios — SPEC.md §13.6, momento 4.
 *
 * Los slots entran escalonados cada 25 ms; con 8 por día la llegada completa
 * dura 200 ms y se lee como un solo golpe (la regla de motion es que
 * `items × stagger` no pase de ~0.5 s). Un slot ocupado NO se sacude ni rebota
 * al intentar seleccionarlo: se queda quieto y su motivo queda en el título.
 * El error no se celebra con movimiento.
 */
export function SlotPicker({
  dias,
  slotSeleccionadoIso,
  onSeleccionar,
}: {
  dias: DiaAgenda[];
  slotSeleccionadoIso: string | null;
  onSeleccionar: (dia: DiaAgenda, slot: SlotAgenda) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {dias.map((dia) => (
        <div
          key={dia.fecha}
          className="border border-filete bg-papel p-3"
          style={{ borderRadius: 2 }}
        >
          <p className="etiqueta text-tinta">{dia.dia_semana}</p>
          <p className="dato mb-2 text-[11px] text-acero">
            {dia.fecha.slice(8, 10)}/{dia.fecha.slice(5, 7)}
          </p>
          {!dia.laborable ? (
            <p className="text-[11px] text-acero">Cerrado</p>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {dia.slots.map((slot, i) => {
                const seleccionado = slot.iso === slotSeleccionadoIso;
                return (
                  <button
                    key={slot.iso}
                    type="button"
                    disabled={!slot.libre}
                    onClick={() => onSeleccionar(dia, slot)}
                    aria-pressed={seleccionado}
                    title={slot.libre ? `Reservar las ${slot.hora}` : "Horario ya reservado"}
                    // Objetivo táctil de 44 px en móvil (§13.8).
                    className={`dato entra min-h-[44px] px-1.5 py-1 text-[11px] font-semibold transition-colors duration-[var(--dur-micro)] sm:min-h-0 ${
                      seleccionado
                        ? "bg-rojo-toyota text-white"
                        : slot.libre
                          ? "border border-verde-taller/30 bg-white text-verde-taller hover:bg-verde-taller hover:text-white"
                          : "cursor-not-allowed border border-filete bg-gris-taller text-acero line-through"
                    }`}
                    style={{ borderRadius: 2, animationDelay: `${i * 25}ms` }}
                  >
                    {slot.hora}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
