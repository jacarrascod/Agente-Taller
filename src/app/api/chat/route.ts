// POST /api/chat — SSE: token, tool_start, tool_end, done, error (SPEC.md §12).
// Rate limit por IP. Proceso Node persistente en Render: sin límite de
// duración de función para el streaming (SPEC.md §15.1).

import { ejecutarTurno } from "@/server/agent/runtime";
import { ipDesdeRequest, limites, verificarRateLimit } from "@/server/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CARACTERES_MENSAJE = 1500;

function eventoSSE(nombre: string, datos: unknown): string {
  return `event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`;
}

export async function POST(request: Request) {
  let body: { session_id?: string; mensaje?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { codigo: "ERROR_DESCONOCIDO", mensaje: "JSON inválido." } }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const mensaje = body.mensaje?.trim();
  if (!sessionId || !mensaje) {
    return Response.json(
      { error: { codigo: "ERROR_DESCONOCIDO", mensaje: "Faltan session_id o mensaje." } },
      { status: 400 },
    );
  }
  if (mensaje.length > MAX_CARACTERES_MENSAJE) {
    return Response.json(
      {
        error: {
          codigo: "LIMITE_EXCEDIDO",
          mensaje: `El mensaje supera los ${MAX_CARACTERES_MENSAJE} caracteres.`,
        },
      },
      { status: 400 },
    );
  }

  const ip = ipDesdeRequest(request);
  const rateLimit = verificarRateLimit(`chat:${ip}`, limites.chatPorMinuto, 60_000);
  if (!rateLimit.permitido) {
    return Response.json(
      { error: { codigo: "LIMITE_EXCEDIDO", mensaje: "Demasiados mensajes. Espere un momento antes de continuar." } },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.reiniciaEnMs / 1000)) } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const encoder = new TextEncoder();
      try {
        for await (const evento of ejecutarTurno({ sessionId, mensajeNuevo: mensaje })) {
          switch (evento.tipo) {
            case "token":
              controlador.enqueue(encoder.encode(eventoSSE("token", { texto: evento.texto })));
              break;
            case "tool_start":
              controlador.enqueue(
                encoder.encode(eventoSSE("tool_start", { nombre: evento.nombre, etiqueta: evento.etiqueta })),
              );
              break;
            case "tool_end":
              controlador.enqueue(
                encoder.encode(
                  eventoSSE("tool_end", { nombre: evento.nombre, resultado: evento.resultado, es_error: evento.esError }),
                ),
              );
              break;
            case "done":
              controlador.enqueue(encoder.encode(eventoSSE("done", { texto_final: evento.textoFinal })));
              break;
            case "error":
              controlador.enqueue(encoder.encode(eventoSSE("error", { mensaje: evento.mensaje })));
              break;
          }
        }
      } catch (error) {
        console.error("Error inesperado en el stream del chat:", error);
        controlador.enqueue(
          encoder.encode(eventoSSE("error", { mensaje: "El asistente no está disponible en este momento." })),
        );
      } finally {
        controlador.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
