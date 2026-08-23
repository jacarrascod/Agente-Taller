// Rate limit en memoria, por IP y por "cubeta" (bucket) nombrada.
//
// Válido mientras Render corra UNA sola instancia del Web Service (SPEC.md
// §15.1). Si el día de mañana se escala a más de una instancia, este
// contador deja de ser confiable entre procesos y habría que moverlo a una
// tabla de Supabase o a Redis — está anotado aquí a propósito.

interface Contador {
  cuenta: number;
  reiniciaEn: number;
}

const cubetas = new Map<string, Contador>();

// Limpieza perezosa para no acumular memoria indefinidamente.
function limpiarExpirados(ahora: number) {
  for (const [clave, contador] of cubetas) {
    if (contador.reiniciaEn <= ahora) cubetas.delete(clave);
  }
}

export interface ResultadoRateLimit {
  permitido: boolean;
  restantes: number;
  reiniciaEnMs: number;
}

/**
 * @param clave identificador único (ej. `chat:${ip}`)
 * @param limite máximo de eventos permitidos en la ventana
 * @param ventanaMs duración de la ventana en milisegundos
 */
export function verificarRateLimit(clave: string, limite: number, ventanaMs: number): ResultadoRateLimit {
  const ahora = Date.now();
  if (cubetas.size > 5000) limpiarExpirados(ahora);

  let contador = cubetas.get(clave);
  if (!contador || contador.reiniciaEn <= ahora) {
    contador = { cuenta: 0, reiniciaEn: ahora + ventanaMs };
    cubetas.set(clave, contador);
  }

  contador.cuenta += 1;
  const permitido = contador.cuenta <= limite;
  return {
    permitido,
    restantes: Math.max(0, limite - contador.cuenta),
    reiniciaEnMs: contador.reiniciaEn - ahora,
  };
}

export function ipDesdeRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconocida";
}

// Límites del negocio (SPEC.md §5, §15).
export const limites = {
  chatPorMinuto: Number(process.env.RATE_LIMIT_CHAT_POR_MINUTO ?? 15),
  citasPorMinuto: Number(process.env.RATE_LIMIT_CITAS_POR_MINUTO ?? 5),
  agendarPorHora: Number(process.env.RATE_LIMIT_AGENDAR_POR_HORA ?? 3),
} as const;
