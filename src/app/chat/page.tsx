import { ChatPanel } from "@/components/chat/ChatPanel";
import { agente } from "@/lib/agente";

export default function PaginaChat() {
  return (
    <div className="mx-auto flex h-[calc(100vh-5.5rem)] max-w-3xl flex-col border-x border-filete">
      <div className="flex items-center gap-2.5 border-b border-filete bg-negro-motor px-4 py-3">
        <span
          className="display flex h-8 w-8 items-center justify-center bg-rojo-toyota text-xs text-white"
          style={{ borderRadius: 2 }}
          aria-hidden="true"
        >
          {agente.nombre.charAt(0)}
        </span>
        {/* Se presenta por su oficio, no por su tecnología (SPEC.md §9.1). */}
        <span className="text-sm font-semibold text-white">{agente.firma}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
