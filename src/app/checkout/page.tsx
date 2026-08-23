"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Boton } from "@/components/ui/Button";
import { Tarjeta } from "@/components/ui/Card";
import { CampoFormulario, Entrada, Etiqueta } from "@/components/ui/Input";
import { leerCarrito, vaciarCarrito } from "@/lib/carrito";
import { formatearPEN } from "@/lib/formato";
import { DISTRITOS_LIMA_CON_COBERTURA } from "@/lib/distritos";
import { esCvvValido, esNumeroTarjetaValido, esVencimientoValido, evaluarTarjetaDemo } from "@/lib/pago";
import type { RepuestoFicha } from "@/types/dominio";

const ENVIO_GRATIS_DESDE = 300;
const ENVIO_COSTO = 15;
const IGV_PORCENTAJE = 18;

interface FilaCarrito {
  sku: string;
  cantidad: number;
  producto: RepuestoFicha;
}

export default function PaginaCheckout() {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaCarrito[] | null>(null);
  const [modalidad, setModalidad] = useState<"recojo" | "delivery">("recojo");
  const [direccion, setDireccion] = useState("");
  const [distrito, setDistrito] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nombreTarjeta, setNombreTarjeta] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  useEffect(() => {
    const items = leerCarrito();
    if (items.length === 0) {
      setFilas([]);
      return;
    }
    Promise.all(
      items.map(async (item) => {
        const respuesta = await fetch(`/api/repuestos/sku/${item.sku}`);
        const producto = await respuesta.json();
        return { sku: item.sku, cantidad: item.cantidad, producto };
      }),
    ).then(setFilas);
  }, []);

  const montoItems = (filas ?? []).reduce((acc, f) => acc + f.producto.precio * f.cantidad, 0);
  const costoEnvio = modalidad === "recojo" ? 0 : montoItems >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_COSTO;
  const total = montoItems + costoEnvio;
  const subtotal = Math.round((total / (1 + IGV_PORCENTAJE / 100)) * 100) / 100;
  const igv = Math.round((total - subtotal) * 100) / 100;

  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!nombre.trim()) nuevosErrores.nombre = "Ingrese su nombre completo.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nuevosErrores.email = "Ingrese un correo válido.";
    if (!telefono.trim()) nuevosErrores.telefono = "Ingrese un teléfono de contacto.";
    if (modalidad === "delivery") {
      if (!direccion.trim()) nuevosErrores.direccion = "La dirección es obligatoria para delivery.";
      if (!distrito) nuevosErrores.distrito = "Seleccione un distrito con cobertura.";
    }
    if (!nombreTarjeta.trim()) nuevosErrores.nombreTarjeta = "Ingrese el nombre en la tarjeta.";
    if (!esNumeroTarjetaValido(numeroTarjeta)) nuevosErrores.numeroTarjeta = "Número de tarjeta inválido.";
    const [mm, aa] = vencimiento.split("/").map((s) => s.trim());
    if (!mm || !aa || !esVencimientoValido(mm, aa)) nuevosErrores.vencimiento = "Vencimiento inválido o expirado.";
    if (!esCvvValido(cvv)) nuevosErrores.cvv = "CVV inválido (3 dígitos).";
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function pagar() {
    setErrorGeneral(null);
    if (!validar() || !filas || filas.length === 0) return;

    setProcesando(true);
    const resultado = evaluarTarjetaDemo(numeroTarjeta);
    const espera = 1500 + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, espera));

    if (!resultado.aprobado) {
      setProcesando(false);
      setErrorGeneral(`Tarjeta rechazada: ${resultado.motivo}. Pruebe con 4111 1111 1111 1111.`);
      return;
    }

    try {
      const respuesta = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: { nombre, email, telefono },
          entrega: {
            modalidad,
            direccion: modalidad === "delivery" ? direccion : undefined,
            distrito: modalidad === "delivery" ? distrito : undefined,
            referenciaEntrega: modalidad === "delivery" ? referencia : undefined,
          },
          items: filas.map((f) => ({ sku: f.sku, cantidad: f.cantidad })),
          tarjeta: { ultimos4: numeroTarjeta.replace(/\D/g, "").slice(-4) },
        }),
      });
      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data?.error?.mensaje ?? "No se pudo procesar el pedido.");
      vaciarCarrito();
      router.push(`/checkout/confirmacion/${data.codigo}`);
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : "No se pudo procesar el pedido.");
    } finally {
      setProcesando(false);
    }
  }

  if (filas === null) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-acero">Cargando…</div>;
  }
  if (filas.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-acero">
        Su carrito está vacío. <Link href="/repuestos" className="font-bold text-rojo-toyota hover:underline">Ver repuestos</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 rounded-[2px] bg-negro-motor px-4 py-3 text-center text-sm font-bold text-white">
        Compra simulada — no se realizará ningún cobro real.
      </div>
      <h1 className="mb-8 text-2xl font-bold text-tinta">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Tarjeta className="p-6">
            <h2 className="mb-4 text-lg font-bold text-tinta">1. Entrega</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModalidad("recojo")}
                className={`rounded-[2px] border p-4 text-left text-sm ${modalidad === "recojo" ? "border-rojo-toyota bg-[#FDEAEB]" : "border-filete"}`}
              >
                <p className="font-bold text-tinta">Recojo en tienda</p>
                <p className="text-xs text-acero">Gratis</p>
              </button>
              <button
                type="button"
                onClick={() => setModalidad("delivery")}
                className={`rounded-[2px] border p-4 text-left text-sm ${modalidad === "delivery" ? "border-rojo-toyota bg-[#FDEAEB]" : "border-filete"}`}
              >
                <p className="font-bold text-tinta">Delivery en Lima</p>
                <p className="text-xs text-acero">
                  {formatearPEN(ENVIO_COSTO)} · gratis desde {formatearPEN(ENVIO_GRATIS_DESDE)}
                </p>
              </button>
            </div>

            {modalidad === "delivery" ? (
              <div className="mt-4 space-y-3">
                <CampoFormulario label="Dirección" htmlFor="direccion" error={errores.direccion}>
                  <Entrada id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </CampoFormulario>
                <div>
                  <Etiqueta htmlFor="distrito">Distrito</Etiqueta>
                  <select
                    id="distrito"
                    value={distrito}
                    onChange={(e) => setDistrito(e.target.value)}
                    className="w-full rounded-[2px] border border-filete px-3 py-2 text-sm"
                  >
                    <option value="">Seleccione un distrito</option>
                    {DISTRITOS_LIMA_CON_COBERTURA.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errores.distrito ? <p className="mt-1 text-xs text-rojo-toyota">{errores.distrito}</p> : null}
                  <p className="mt-1 text-xs text-acero">Provincias: por ahora solo hay recojo en tienda.</p>
                </div>
                <CampoFormulario label="Referencia (opcional)" htmlFor="referencia">
                  <Entrada id="referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
                </CampoFormulario>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <CampoFormulario label="Nombre completo" htmlFor="nombre" error={errores.nombre}>
                <Entrada id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </CampoFormulario>
              <CampoFormulario label="Correo electrónico" htmlFor="email" error={errores.email}>
                <Entrada id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </CampoFormulario>
              <CampoFormulario label="Teléfono" htmlFor="telefono" error={errores.telefono}>
                <Entrada id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </CampoFormulario>
            </div>
          </Tarjeta>

          <Tarjeta className="p-6">
            <h2 className="mb-2 text-lg font-bold text-tinta">2. Pago</h2>
            <div className="mb-4 rounded-[2px] bg-papel p-3 text-xs text-tinta">
              <p className="font-bold">Tarjetas de prueba</p>
              <p>4111 1111 1111 1111 → aprobada</p>
              <p>4000 0000 0000 0002 → rechazada (fondos insuficientes)</p>
              <p>4000 0000 0000 0069 → rechazada (tarjeta vencida)</p>
            </div>
            <div className="space-y-3">
              <CampoFormulario label="Nombre en la tarjeta" htmlFor="nombreTarjeta" error={errores.nombreTarjeta}>
                <Entrada id="nombreTarjeta" value={nombreTarjeta} onChange={(e) => setNombreTarjeta(e.target.value)} />
              </CampoFormulario>
              <CampoFormulario label="Número de tarjeta" htmlFor="numeroTarjeta" error={errores.numeroTarjeta}>
                <Entrada
                  id="numeroTarjeta"
                  inputMode="numeric"
                  placeholder="4111 1111 1111 1111"
                  value={numeroTarjeta}
                  onChange={(e) => setNumeroTarjeta(e.target.value)}
                />
              </CampoFormulario>
              <div className="grid grid-cols-2 gap-3">
                <CampoFormulario label="Vencimiento (MM/AA)" htmlFor="vencimiento" error={errores.vencimiento}>
                  <Entrada id="vencimiento" placeholder="12/28" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
                </CampoFormulario>
                <CampoFormulario label="CVV" htmlFor="cvv" error={errores.cvv}>
                  <Entrada id="cvv" inputMode="numeric" maxLength={3} value={cvv} onChange={(e) => setCvv(e.target.value)} />
                </CampoFormulario>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-acero">
              El número completo, el CVV y el vencimiento se validan en este dispositivo y nunca se envían a
              nuestro servidor: solo se registran los últimos 4 dígitos.
            </p>
          </Tarjeta>
        </div>

        <Tarjeta className="h-fit p-6">
          <h2 className="mb-4 text-lg font-bold text-tinta">Resumen</h2>
          <div className="space-y-2 text-sm">
            {filas.map((f) => (
              <div key={f.sku} className="flex justify-between text-tinta">
                <span className="linea-clamp-2 pr-2">
                  {f.producto.nombre} × {f.cantidad}
                </span>
                <span className="flex-shrink-0 font-medium">{formatearPEN(f.producto.precio * f.cantidad)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t border-filete pt-4 text-sm">
            <div className="flex justify-between text-acero">
              <span>Monto de ítems</span>
              <span>{formatearPEN(montoItems)}</span>
            </div>
            <div className="flex justify-between text-acero">
              <span>Costo de envío</span>
              <span>
                {modalidad === "delivery" && costoEnvio === 0 && montoItems >= ENVIO_GRATIS_DESDE ? (
                  <>
                    <span className="mr-1 line-through">{formatearPEN(ENVIO_COSTO)}</span>Gratis
                  </>
                ) : (
                  formatearPEN(costoEnvio)
                )}
              </span>
            </div>
            <div className="flex justify-between text-lg font-black text-tinta">
              <span>Total</span>
              <span>{formatearPEN(total)}</span>
            </div>
            <p className="text-xs text-acero">Incluye IGV: {formatearPEN(igv)}</p>
          </div>

          {errorGeneral ? <p className="mt-4 text-sm font-medium text-rojo-toyota">{errorGeneral}</p> : null}

          <Boton className="mt-6 w-full" onClick={pagar} disabled={procesando}>
            {procesando ? "Procesando pago…" : `Pagar ${formatearPEN(total)}`}
          </Boton>
        </Tarjeta>
      </div>
    </div>
  );
}
