// Parser mínimo de Server-Sent Events sobre `fetch` (EventSource no admite
// POST, que es lo que necesita /api/chat).

export interface EventoSSE {
  evento: string;
  datos: unknown;
}

export async function* leerEventosSSE(response: Response): AsyncGenerator<EventoSSE> {
  if (!response.body) return;
  const lector = response.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    buffer += decodificador.decode(value, { stream: true });

    const bloques = buffer.split("\n\n");
    buffer = bloques.pop() ?? "";

    for (const bloque of bloques) {
      let evento = "message";
      let datosCrudos = "";
      for (const linea of bloque.split("\n")) {
        if (linea.startsWith("event:")) evento = linea.slice(6).trim();
        else if (linea.startsWith("data:")) datosCrudos += linea.slice(5).trim();
      }
      if (!datosCrudos) continue;
      try {
        yield { evento, datos: JSON.parse(datosCrudos) };
      } catch {
        yield { evento, datos: datosCrudos };
      }
    }
  }
}
