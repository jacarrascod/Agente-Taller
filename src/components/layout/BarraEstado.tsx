import { taller, negocio } from "@/server/lib/taller";
import {
  diaSemanaIsoLima,
  horaHMLima,
  nombreDiaSemanaLima,
  siguienteDiaHabilYMD,
  fechaYMDLima,
  construirInstanteLima,
} from "@/server/lib/fechas";

/**
 * Barra de estado del taller (SPEC.md §13.1).
 *
 * No es decoración: el indicador se calcula con la MISMA lógica de
 * `server/lib/fechas` con la que la agenda decide si un horario existe.
 * Tenerlo siempre a la vista respalda lo que el agente responde en el chat
 * cuando le preguntan si el taller está abierto (CA-43).
 */
function estadoActual(ahora: Date) {
  const dia = diaSemanaIsoLima(ahora);
  const hora = Number(horaHMLima(ahora).slice(0, 2));
  const esLaborable = negocio.diasLaborables.includes(dia);
  const abierto = esLaborable && hora >= negocio.horaApertura && hora < negocio.horaCierre;

  if (abierto) {
    return {
      abierto: true,
      texto: `ABIERTO — CIERRA ${String(negocio.horaCierre).padStart(2, "0")}:00`,
    };
  }

  // Si ya cerró hoy o es fin de semana, el próximo día hábil manda.
  const hoyYMD = fechaYMDLima(ahora);
  const proximoYMD =
    esLaborable && hora < negocio.horaApertura ? hoyYMD : siguienteDiaHabilYMD(hoyYMD);
  const proximaApertura = construirInstanteLima(proximoYMD, negocio.horaApertura);
  const dia_ = proximoYMD === hoyYMD ? "HOY" : nombreDiaSemanaLima(proximaApertura).toUpperCase();

  return {
    abierto: false,
    texto: `CERRADO — ABRE ${dia_} ${String(negocio.horaApertura).padStart(2, "0")}:00`,
  };
}

export function BarraEstado() {
  const estado = estadoActual(new Date());

  return (
    <div className="bg-negro-motor text-white">
      <div className="mx-auto flex h-8 max-w-6xl items-center gap-3 overflow-x-auto px-4 whitespace-nowrap">
        <span className="dato text-[11px] tracking-wider text-white/70">
          {taller.nombre.toUpperCase()}
        </span>
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <span className="dato text-[11px] text-white/70">LUN–VIE 09:00–17:00</span>
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <span className="dato flex items-center gap-1.5 text-[11px] font-semibold">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              estado.abierto ? "bg-verde-taller" : "bg-acero"
            }`}
          />
          {estado.texto}
        </span>
        <span className="text-white/25" aria-hidden="true">
          ·
        </span>
        <a href={`tel:${taller.telefono.replace(/\D/g, "")}`} className="dato text-[11px] text-white/70 hover:text-white">
          {taller.telefono}
        </a>
      </div>
    </div>
  );
}
