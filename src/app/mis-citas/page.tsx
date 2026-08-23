"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Button";
import { CampoFormulario, Entrada } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { TarjetaCita } from "@/components/agenda/TarjetaCita";
import type { CitaFormateada } from "@/types/dominio";

export default function PaginaMisCitas() {
  const [email, setEmail] = useState("");
  const [citas, setCitas] = useState<CitaFormateada[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citaACancelar, setCitaACancelar] = useState<CitaFormateada | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [mensajeCancelacion, setMensajeCancelacion] = useState<string | null>(null);

  async function buscarCitas(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    setMensajeCancelacion(null);
    try {
      const respuesta = await fetch(`/api/citas?email=${encodeURIComponent(email)}&incluir_pasadas=true`);
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data?.error?.mensaje ?? "No se pudo consultar.");
      setCitas(data.citas ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar sus citas.");
      setCitas(null);
    } finally {
      setBuscando(false);
    }
  }

  async function confirmarCancelacion() {
    if (!citaACancelar) return;
    setCancelando(true);
    try {
      const respuesta = await fetch(`/api/citas/${citaACancelar.codigo}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data?.error?.mensaje ?? "No se pudo cancelar la cita.");
      setMensajeCancelacion(
        data.email_enviado
          ? `La cita ${data.codigo} quedó cancelada. Le enviamos la constancia por correo.`
          : `La cita ${data.codigo} quedó cancelada.`,
      );
      setCitas((prev) =>
        (prev ?? []).map((c) => (c.codigo === citaACancelar.codigo ? { ...c, estado: "cancelada" } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la cita.");
    } finally {
      setCancelando(false);
      setCitaACancelar(null);
    }
  }

  const futuras = (citas ?? []).filter((c) => c.es_futura);
  const historial = (citas ?? []).filter((c) => !c.es_futura);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-tinta">Mis citas</h1>
      <p className="mt-2 text-sm text-acero">
        Su correo electrónico es la llave para ver sus citas. Escríbalo tal como lo usó al agendar.
      </p>

      <form onSubmit={buscarCitas} className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <CampoFormulario label="Correo electrónico" htmlFor="email-citas">
            <Entrada
              id="email-citas"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usted@correo.com"
            />
          </CampoFormulario>
        </div>
        <Boton type="submit" disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Boton>
      </form>

      {error ? <p className="mt-4 text-sm font-medium text-rojo-toyota">{error}</p> : null}
      {mensajeCancelacion ? (
        <p className="mt-4 rounded-[2px] bg-[#E6F4EA] p-3 text-sm text-verde-taller">{mensajeCancelacion}</p>
      ) : null}

      {citas !== null ? (
        citas.length === 0 ? (
          <p className="mt-8 rounded-[2px] border border-filete p-6 text-center text-sm text-acero">
            No encontramos citas con ese correo. ¿Podría ser que la haya agendado con otra dirección?{" "}
            <a href="/agenda" className="font-bold text-rojo-toyota hover:underline">
              Agende una ahora
            </a>
            .
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {futuras.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-bold text-tinta">Próximas</h2>
                <div className="space-y-3">
                  {futuras.map((c) => (
                    <TarjetaCita key={c.codigo} cita={c} onCancelar={setCitaACancelar} />
                  ))}
                </div>
              </div>
            ) : null}
            {historial.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-bold text-tinta">Historial</h2>
                <div className="space-y-3">
                  {historial.map((c) => (
                    <TarjetaCita key={c.codigo} cita={c} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      <Modal abierto={!!citaACancelar} onCerrar={() => setCitaACancelar(null)} titulo="Cancelar cita">
        {citaACancelar ? (
          <>
            <p className="text-sm text-tinta">
              ¿Confirma que desea cancelar la cita <strong>{citaACancelar.codigo}</strong> (
              {citaACancelar.servicio}) del {citaACancelar.fecha_legible}, {citaACancelar.hora} h?
            </p>
            <p className="mt-2 text-xs text-acero">
              Esta acción no se puede deshacer. Si luego desea venir, deberá agendar una nueva cita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Boton variante="contorno" onClick={() => setCitaACancelar(null)}>
                Volver
              </Boton>
              <Boton variante="primario" onClick={confirmarCancelacion} disabled={cancelando}>
                {cancelando ? "Cancelando…" : "Sí, cancelar"}
              </Boton>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
