// Puente entre páginas y el ChatWidget flotante: "Consultar a Toño sobre
// este repuesto" abre el chat con el SKU precargado en el input, sin
// enviarlo automáticamente (el cliente revisa y confirma el mensaje).

export const EVENTO_ABRIR_CHAT = "ttp:abrir-chat";

export function abrirChatConTexto(texto: string): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_CHAT, { detail: { texto } }));
}
