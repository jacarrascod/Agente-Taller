import { AgendaCliente } from "@/components/agenda/AgendaCliente";
import { listarMantenimientos } from "@/server/services/catalogo";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ servicio?: string }>;
}

export default async function PaginaAgenda({ searchParams }: Props) {
  const { servicio } = await searchParams;
  const mantenimientos = await listarMantenimientos();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-tinta">Agendar mantenimiento</h1>
      <p className="mt-2 max-w-2xl text-sm text-acero">
        Elija el servicio y un horario disponible. Atendemos de lunes a viernes, de 09:00 a
        17:00. Cada cita dura 1 hora.
      </p>
      <div className="mt-8">
        <AgendaCliente mantenimientos={mantenimientos} servicioInicial={servicio} />
      </div>
    </div>
  );
}
