"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatPanel } from "./ChatPanel";
import { agente } from "@/lib/agente";
import { esPrimeraVisita } from "@/lib/chat-sesion";
import { EVENTO_ABRIR_CHAT } from "@/lib/chat-eventos";

export function ChatWidget() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [mostrarBadge, setMostrarBadge] = useState(false);
  const [textoInicial, setTextoInicial] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMostrarBadge(esPrimeraVisita());
  }, []);

  useEffect(() => {
    function onAbrirChat(evento: Event) {
      const detalle = (evento as CustomEvent<{ texto: string }>).detail;
      setTextoInicial(detalle?.texto);
      setAbierto(true);
    }
    window.addEventListener(EVENTO_ABRIR_CHAT, onAbrirChat);
    return () => window.removeEventListener(EVENTO_ABRIR_CHAT, onAbrirChat);
  }, []);

  if (pathname === "/chat") return null;

  return (
    <>
      {abierto ? (
        <div
          role="dialog"
          aria-label={`Chat con ${agente.nombre}`}
          className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[620px] sm:w-[400px] sm:rounded-[2px] sm:border sm:border-filete sm:shadow-xl"
        >
          <div className="flex items-center justify-between bg-negro-motor px-4 py-3 ">
            <div className="flex items-center gap-2">
              <span
                className="display flex h-7 w-7 items-center justify-center rounded-[2px] bg-rojo-toyota text-xs text-white"
                aria-hidden="true"
              >
                {agente.nombre.charAt(0)}
              </span>
              <span className="text-sm font-semibold text-white">{agente.firma}</span>
            </div>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="rounded-[2px] p-1.5 text-white hover:bg-white/10"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel textoInicial={textoInicial} />
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar chat" : `Abrir chat con ${agente.nombre}`}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-[2px] bg-rojo-toyota text-white shadow-lg hover:bg-rojo-oscuro"
      >
        {mostrarBadge && !abierto ? (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-[2px] bg-negro-motor text-[10px] font-bold text-white">
            1
          </span>
        ) : null}
        <span className="text-lg font-black">{abierto ? "✕" : "TTP"}</span>
      </button>
    </>
  );
}
