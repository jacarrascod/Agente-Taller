"use client";

import { useEffect, useMemo, useState } from "react";
import { Boton } from "../ui/Button";
import { CampoFormulario, Entrada } from "../ui/Input";
import { Tarjeta } from "../ui/Card";
import { SlotPicker } from "./SlotPicker";
import { formatearPEN } from "@/lib/formato";
import type { DiaAgenda, Mantenimiento, SlotAgenda } from "@/types/dominio";

function hoyYMD(): string {
  const ahora = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(ahora);
}

function sumarDiasYMD(fechaYMD: string, dias: number): string {
  const [y, m, d] = fechaYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const nueva = new Date(base.getTime() + dias * 86_400_000);
  return `${nueva.getUTCFullYear()}-${String(nueva.getUTCMonth() + 1).padStart(2, "0")}-${String(nueva.getUTCDate()).padStart(2, "0")}`;
}

export function AgendaCliente({
  mantenimientos,
  servicioInicial,
}: {
  mantenimientos: Mantenimiento[];
  servicioInicial?: string;
}) {
  const [servicio, setServicio] = useState(servicioInicial ?? mantenimientos[0]?.slug ?? "");
  const [semana, setSemana] = useState(0);
  const [dias, setDias] = useState<DiaAgenda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaAgenda | null>(null);
  const [slotSeleccionado, setSlotSeleccionado] = useState<SlotAgenda | null>(null);
  const [confirmacion, setConfirmacion] = useState<{ codigo: string; inicioLegible: string; emailEnviado: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alternativas, setAlternativas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", modelo: "", anio: "", placa: "" });

  const mantenimientoSeleccionado = mantenimientos.find((m) => m.slug === servicio);
  const fechaInicioSemana = useMemo(() => sumarDiasYMD(hoyYMD(), semana * 7), [semana]);
  const fechaFinSemana = useMemo(() => sumarDiasYMD(fechaInicioSemana, 6), [fechaInicioSemana]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    fetch(`/api/agenda/disponibilidad?fecha=${fechaInicioSemana}&fecha_hasta=${fechaFinSemana}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        setDias(data.dias ?? []);
      })
      .catch(() => !cancelado && setError("No se pudo cargar la disponibilidad."))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [fechaInicioSemana, fechaFinSemana]);

  async function confirmarCita() {
    if (!slotSeleccionado || !mantenimientoSeleccionado) return;
    setEnviando(true);
    setError(null);
    setAlternativas([]);
    try {
      const respuesta = await fetch("/api/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inicio_iso: slotSeleccionado.iso,
          mantenimiento_slug: servicio,
          nombre_cliente: form.nombre,
          email: form.email,
          telefono: form.telefono,
          modelo_vehiculo: form.modelo,
          anio_vehiculo: form.anio ? Number(form.anio) : undefined,
          placa: form.placa || undefined,
        }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) {
        if (data?.error?.codigo === "SLOT_OCUPADO") {
          setError("Ese horario ya no está disponible.");
          setAlternativas(data.error.detalle?.alternativas ?? []);
        } else {
          setError(data?.error?.mensaje ?? "No se pudo registrar la cita.");
        }
        return;
      }
      setConfirmacion({
        codigo: data.codigo,
        inicioLegible: `${diaSeleccionado?.dia_semana ?? ""} ${diaSeleccionado?.fecha ?? ""}, ${slotSeleccionado.hora}`,
        emailEnviado: data.email_enviado,
      });
    } catch {
      setError("No se pudo conectar con el servidor. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmacion) {
    return (
      <Tarjeta className="mx-auto max-w-lg p-8 text-center">
        <p className="text-4xl">✅</p>
        <h2 className="mt-3 text-xl font-bold text-tinta">¡Cita confirmada!</h2>
        <p className="mt-2 text-sm text-acero">
          Código <span className="font-bold text-tinta">{confirmacion.codigo}</span>
        </p>
        <p className="mt-1 text-sm capitalize text-acero">{confirmacion.inicioLegible}</p>
        <p className="mt-4 text-sm text-tinta">
          {confirmacion.emailEnviado
            ? "Le enviamos la confirmación por correo con la dirección del taller. Revise también spam."
            : "No pudimos enviarle el correo, pero su cita quedó registrada. Anote el código."}
        </p>
      </Tarjeta>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="servicio" className="mb-1 block text-sm font-bold text-tinta">
          Servicio
        </label>
        <select
          id="servicio"
          value={servicio}
          onChange={(e) => {
            setServicio(e.target.value);
            setSlotSeleccionado(null);
          }}
          className="w-full max-w-sm rounded-[2px] border border-filete px-3 py-2 text-sm"
        >
          {mantenimientos.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nombre} — {formatearPEN(m.precio)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-tinta">
            Semana del {fechaInicioSemana} al {fechaFinSemana}
          </h2>
          <div className="flex gap-2">
            <Boton variante="contorno" onClick={() => setSemana((s) => Math.max(0, s - 1))} disabled={semana === 0}>
              ← Anterior
            </Boton>
            <Boton variante="contorno" onClick={() => setSemana((s) => Math.min(3, s + 1))} disabled={semana >= 3}>
              Siguiente →
            </Boton>
          </div>
        </div>
        {cargando ? (
          <p className="text-sm text-acero">Cargando disponibilidad…</p>
        ) : (
          <SlotPicker
            dias={dias}
            slotSeleccionadoIso={slotSeleccionado?.iso ?? null}
            onSeleccionar={(dia, slot) => {
              setDiaSeleccionado(dia);
              setSlotSeleccionado(slot);
              setError(null);
            }}
          />
        )}
      </div>

      {error ? (
        <div className="rounded-[2px] border border-rojo-toyota bg-[#FDEAEB] p-3 text-sm text-rojo-toyota">
          {error}
          {alternativas.length > 0 ? ` Horarios libres ese día: ${alternativas.join(", ")}.` : ""}
        </div>
      ) : null}

      {slotSeleccionado && diaSeleccionado ? (
        <Tarjeta className="max-w-lg p-6">
          <h2 className="text-lg font-bold text-tinta">Confirmar datos</h2>
          <p className="mt-1 text-sm capitalize text-acero">
            {mantenimientoSeleccionado?.nombre} · {diaSeleccionado.dia_semana} {diaSeleccionado.fecha} a las{" "}
            {slotSeleccionado.hora}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              confirmarCita();
            }}
          >
            <CampoFormulario label="Nombre completo" htmlFor="nombre">
              <Entrada
                id="nombre"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </CampoFormulario>
            <CampoFormulario label="Correo electrónico" htmlFor="email">
              <Entrada
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </CampoFormulario>
            <CampoFormulario label="Teléfono" htmlFor="telefono">
              <Entrada
                id="telefono"
                required
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </CampoFormulario>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <CampoFormulario label="Modelo Toyota" htmlFor="modelo">
                  <Entrada
                    id="modelo"
                    required
                    placeholder="Ej: Corolla"
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  />
                </CampoFormulario>
              </div>
              <CampoFormulario label="Año" htmlFor="anio">
                <Entrada
                  id="anio"
                  type="number"
                  value={form.anio}
                  onChange={(e) => setForm({ ...form, anio: e.target.value })}
                />
              </CampoFormulario>
            </div>
            <CampoFormulario label="Placa (opcional)" htmlFor="placa">
              <Entrada id="placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
            </CampoFormulario>
            <Boton type="submit" disabled={enviando} className="w-full">
              {enviando ? "Registrando…" : "Confirmar cita"}
            </Boton>
          </form>
        </Tarjeta>
      ) : null}
    </div>
  );
}
