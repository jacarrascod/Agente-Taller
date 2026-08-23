"use client";

import { useEffect, useRef, useState } from "react";
import { leerEventosSSE } from "@/lib/sse";
import { guardarHistorialChat, leerHistorialChat, obtenerSessionId, type MensajeChat } from "@/lib/chat-sesion";
import { ToolBadge } from "./ToolBadge";
import { formatearPEN } from "@/lib/formato";
import { agente } from "@/lib/agente";
import { agregarAlCarrito } from "@/lib/carrito";
import Image from "next/image";
import Link from "next/link";
import type { CitaFormateada } from "@/types/dominio";

const CHIPS_SUGERENCIA = [
  "¿Tienen filtro de aceite para Corolla?",
  "Quiero agendar un mantenimiento",
  "¿Cuándo es mi cita?",
  "¿Cada cuánto cambio las pastillas?",
];

interface RepuestoMencionado {
  sku: string;
  nombre: string;
  precio: number;
  imagen_url: string;
  url: string;
}

function nuevoId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatPanel({ textoInicial }: { textoInicial?: string }) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (textoInicial) setInput(textoInicial);
  }, [textoInicial]);
  const [enviando, setEnviando] = useState(false);
  const [herramientasEnCurso, setHerramientasEnCurso] = useState<{ nombre: string; etiqueta: string }[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = obtenerSessionId();
    setMensajes(leerHistorialChat());
  }, []);

  useEffect(() => {
    // `block: "nearest"` y la guarda por conversación vacía evitan que al
    // cargar la página el navegador salte al pie del hilo: sin esto, entrar a
    // /chat desplazaba toda la ventana y el saludo quedaba fuera de vista.
    if (mensajes.length === 0 && herramientasEnCurso.length === 0) return;
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes, herramientasEnCurso]);

  async function enviarMensaje(texto: string) {
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    const mensajeUsuario: MensajeChat = { id: nuevoId(), rol: "user", contenido: limpio };
    const idAsistente = nuevoId();
    const siguientes = [...mensajes, mensajeUsuario, { id: idAsistente, rol: "assistant" as const, contenido: "" }];
    setMensajes(siguientes);
    guardarHistorialChat(siguientes);
    setInput("");
    setEnviando(true);
    setHerramientasEnCurso([]);

    let textoAcumulado = "";
    const toolsUsadas: string[] = [];
    let citasEncontradas: CitaFormateada[] | undefined;
    let repuestosEncontrados: RepuestoMencionado[] | undefined;

    try {
      const respuesta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionIdRef.current, mensaje: limpio }),
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        throw new Error(cuerpo?.error?.mensaje ?? "No se pudo contactar al asistente.");
      }

      for await (const evento of leerEventosSSE(respuesta)) {
        if (evento.evento === "token") {
          const { texto } = evento.datos as { texto: string };
          textoAcumulado += texto;
          setMensajes((prev) =>
            prev.map((m) => (m.id === idAsistente ? { ...m, contenido: textoAcumulado } : m)),
          );
        } else if (evento.evento === "tool_start") {
          const { nombre, etiqueta } = evento.datos as { nombre: string; etiqueta: string };
          setHerramientasEnCurso((prev) => [...prev, { nombre, etiqueta }]);
        } else if (evento.evento === "tool_end") {
          const { nombre, resultado } = evento.datos as { nombre: string; resultado: unknown };
          toolsUsadas.push(nombre);
          setHerramientasEnCurso((prev) => prev.filter((t) => t.nombre !== nombre));

          if (nombre === "consultar_citas" && resultado && typeof resultado === "object") {
            const r = resultado as { citas?: CitaFormateada[] };
            if (r.citas?.length) citasEncontradas = r.citas;
          }
          if (nombre === "buscar_repuestos" && resultado && typeof resultado === "object") {
            const r = resultado as {
              resultados?: { sku: string; nombre: string; precio: number; imagen_url: string; url: string }[];
            };
            if (r.resultados?.length) repuestosEncontrados = r.resultados;
          }
          // DEF-09: la tool agregar_al_carrito solo devuelve un JSON al LLM —
          // no toca el localStorage del navegador por sí sola. Sin este
          // handler, Toño le confirmaba al cliente "se agregó al carrito"
          // (afirmación server-side veraz) mientras el carrito real seguía
          // vacío. Aquí se aplica de verdad el cambio que la tool ya reportó.
          if (nombre === "agregar_al_carrito" && resultado && typeof resultado === "object") {
            const r = resultado as { ok?: boolean; sku?: string; cantidad?: number };
            if (r.ok && r.sku) agregarAlCarrito(r.sku, r.cantidad ?? 1);
          }
        } else if (evento.evento === "error") {
          const { mensaje } = evento.datos as { mensaje: string };
          textoAcumulado = mensaje;
          setMensajes((prev) => prev.map((m) => (m.id === idAsistente ? { ...m, contenido: mensaje } : m)));
        }
      }
    } catch (error) {
      textoAcumulado = error instanceof Error ? error.message : "El asistente no está disponible en este momento.";
      setMensajes((prev) => prev.map((m) => (m.id === idAsistente ? { ...m, contenido: textoAcumulado } : m)));
    } finally {
      setHerramientasEnCurso([]);
      setEnviando(false);
      setMensajes((prev) => {
        const finales = prev.map((m) =>
          m.id === idAsistente
            ? { ...m, contenido: textoAcumulado, toolsUsadas, citas: citasEncontradas, repuestos: repuestosEncontrados }
            : m,
        );
        guardarHistorialChat(finales);
        return finales;
      });
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        role="log"
        aria-live="polite"
        className="flex-1 space-y-4 overflow-y-auto p-4"
      >
        {mensajes.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-acero">
              {`¡Hola! Soy ${agente.nombre} 👋, su asesor en Toyota Taller Perú. ¿En qué puedo ayudarlo?`}
            </p>
            <div className="flex flex-wrap gap-2">
              {CHIPS_SUGERENCIA.map((chip) => (
                <button
                  key={chip}
                  onClick={() => enviarMensaje(chip)}
                  className="rounded-[2px] border border-filete px-3 py-1.5 text-xs font-medium text-tinta hover:border-rojo-toyota hover:text-rojo-toyota"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mensajes.map((m, i) => {
          // Cursor de streaming (SPEC.md §13.6, momento 3): los tokens NO se
          // animan uno por uno —produce un temblor que se lee como ruido—;
          // solo un cursor de bloque parpadea hasta que cierra la respuesta.
          const enStreaming = enviando && m.rol === "assistant" && i === mensajes.length - 1;
          return (
          <div key={m.id} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] space-y-2">
              <div
                className={`whitespace-pre-wrap rounded-[2px] px-4 py-2.5 text-sm ${
                  m.rol === "user"
                    ? "bg-negro-motor text-white"
                    : "border border-filete bg-papel text-tinta"
                }`}
              >
                {m.contenido}
                {enStreaming ? <span className="cursor-stream" aria-hidden="true" /> : null}
              </div>
              {m.citas?.map((c) => (
                <button
                  key={c.codigo}
                  onClick={() => setInput(`Cancelar la cita ${c.codigo}`)}
                  className="block w-full rounded-[2px] border border-filete p-3 text-left text-xs hover:border-rojo-toyota"
                >
                  <p className="font-bold text-tinta">
                    {c.codigo} · {c.servicio}
                  </p>
                  <p className="text-acero">
                    {c.estado} {c.es_futura ? "· próxima" : ""}
                  </p>
                </button>
              ))}
              {m.repuestos?.map((r) => (
                <div key={r.sku} className="flex items-center gap-3 rounded-[2px] border border-filete p-2">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-papel">
                    <Image src={r.imagen_url} alt={r.nombre} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={r.url} className="linea-clamp-2 block text-xs font-semibold text-tinta hover:text-rojo-toyota">
                      {r.nombre}
                    </Link>
                    <p className="text-xs font-bold text-tinta">{formatearPEN(r.precio)}</p>
                  </div>
                  <button
                    onClick={() => agregarAlCarrito(r.sku)}
                    className="flex-shrink-0 rounded-[2px] bg-rojo-toyota px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rojo-oscuro"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>
          );
        })}

        {herramientasEnCurso.map((h) => (
          <ToolBadge key={h.nombre} etiqueta={h.etiqueta} />
        ))}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarMensaje(input);
        }}
        className="flex items-center gap-2 border-t border-filete p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escriba su consulta…"
          maxLength={1500}
          disabled={enviando}
          className="flex-1 rounded-[2px] border border-filete px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo-toyota"
          aria-label={`Mensaje para ${agente.nombre}`}
        />
        <button
          type="submit"
          disabled={enviando || !input.trim()}
          className="rounded-[2px] bg-rojo-toyota px-4 py-2 text-sm font-bold text-white hover:bg-rojo-oscuro disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
