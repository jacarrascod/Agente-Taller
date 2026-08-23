import { Tarjeta } from "../ui/Card";
import { Insignia } from "../ui/Badge";
import { formatearPEN } from "@/lib/formato";
import type { CitaFormateada } from "@/types/dominio";

const ESTADO_TEXTO: Record<CitaFormateada["estado"], string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  atendida: "Atendida",
  no_asistio: "No asistió",
};

const ESTADO_TONO: Record<CitaFormateada["estado"], "verde" | "gris" | "neutro" | "ambar"> = {
  confirmada: "verde",
  cancelada: "gris",
  atendida: "neutro",
  no_asistio: "ambar",
};

export function TarjetaCita({
  cita,
  onCancelar,
}: {
  cita: CitaFormateada;
  onCancelar?: (cita: CitaFormateada) => void;
}) {
  return (
    <Tarjeta className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-acero">{cita.codigo}</p>
          <h3 className="text-sm font-bold text-tinta">{cita.servicio}</h3>
        </div>
        <Insignia tono={ESTADO_TONO[cita.estado]}>{ESTADO_TEXTO[cita.estado]}</Insignia>
      </div>
      <div className="mt-3 space-y-1 text-sm text-tinta">
        <p className="capitalize">{cita.fecha_legible}</p>
        <p>{cita.hora} h</p>
        <p className="text-acero">{cita.vehiculo}</p>
        <p className="font-bold text-tinta">{formatearPEN(cita.precio)}</p>
      </div>
      {cita.cancelable && onCancelar ? (
        <button
          onClick={() => onCancelar(cita)}
          className="mt-4 text-sm font-bold text-rojo-toyota hover:underline"
        >
          Cancelar cita
        </button>
      ) : null}
    </Tarjeta>
  );
}
