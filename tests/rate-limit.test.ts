import { describe, expect, it, vi } from "vitest";
import { ipDesdeRequest, verificarRateLimit } from "@/server/lib/rate-limit";

// Cada test usa una clave única (via `crypto.randomUUID()`-like sufijo) para
// no compartir estado con otros tests: `cubetas` es un Map de módulo.
let contador = 0;
function claveUnica(prefijo: string): string {
  contador += 1;
  return `${prefijo}:${contador}:${Date.now()}`;
}

describe("verificarRateLimit", () => {
  it("permite hasta el límite exacto de N eventos", () => {
    const clave = claveUnica("chat");
    for (let i = 0; i < 5; i++) {
      const r = verificarRateLimit(clave, 5, 60_000);
      expect(r.permitido).toBe(true);
    }
  });

  it("rechaza el evento N+1", () => {
    const clave = claveUnica("chat");
    for (let i = 0; i < 5; i++) verificarRateLimit(clave, 5, 60_000);
    const r = verificarRateLimit(clave, 5, 60_000);
    expect(r.permitido).toBe(false);
    expect(r.restantes).toBe(0);
  });

  it("permite de nuevo tras vencer la ventana", () => {
    vi.useFakeTimers();
    try {
      const clave = claveUnica("chat");
      for (let i = 0; i < 3; i++) verificarRateLimit(clave, 3, 1000);
      expect(verificarRateLimit(clave, 3, 1000).permitido).toBe(false);

      vi.advanceTimersByTime(1001);

      expect(verificarRateLimit(clave, 3, 1000).permitido).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("claves distintas no interfieren entre sí", () => {
    const claveA = claveUnica("chat-a");
    const claveB = claveUnica("chat-b");
    for (let i = 0; i < 3; i++) verificarRateLimit(claveA, 3, 60_000);
    // claveB empieza fresca, no arrastra el conteo de claveA.
    expect(verificarRateLimit(claveB, 3, 60_000).permitido).toBe(true);
    expect(verificarRateLimit(claveA, 3, 60_000).permitido).toBe(false);
  });

  it("prefijos distintos para la misma IP no interfieren (chat: vs citas:)", () => {
    const ip = `1.2.3.${contador++}`;
    const claveChat = `chat:${ip}`;
    const claveCitas = `citas:${ip}`;
    for (let i = 0; i < 15; i++) verificarRateLimit(claveChat, 15, 60_000);
    expect(verificarRateLimit(claveChat, 15, 60_000).permitido).toBe(false);
    // El límite de citas es independiente del de chat, aunque comparten IP.
    expect(verificarRateLimit(claveCitas, 5, 60_000).permitido).toBe(true);
  });

  it("restantes decrece correctamente evento a evento", () => {
    const clave = claveUnica("chat");
    expect(verificarRateLimit(clave, 3, 60_000).restantes).toBe(2);
    expect(verificarRateLimit(clave, 3, 60_000).restantes).toBe(1);
    expect(verificarRateLimit(clave, 3, 60_000).restantes).toBe(0);
    expect(verificarRateLimit(clave, 3, 60_000).restantes).toBe(0); // nunca negativo
  });
});

describe("ipDesdeRequest", () => {
  it("toma la primera IP de x-forwarded-for (el cliente original, no el último proxy)", () => {
    const req = new Request("http://localhost/api/chat", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" },
    });
    expect(ipDesdeRequest(req)).toBe("1.1.1.1");
  });

  it("recorta espacios alrededor de la IP", () => {
    const req = new Request("http://localhost/api/chat", {
      headers: { "x-forwarded-for": "  1.1.1.1  , 2.2.2.2" },
    });
    expect(ipDesdeRequest(req)).toBe("1.1.1.1");
  });

  it("usa x-real-ip cuando no hay x-forwarded-for", () => {
    const req = new Request("http://localhost/api/chat", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(ipDesdeRequest(req)).toBe("9.9.9.9");
  });

  it("devuelve un valor de respaldo estable sin ninguna cabecera de proxy", () => {
    const req = new Request("http://localhost/api/chat");
    expect(ipDesdeRequest(req)).toBe("desconocida");
  });
});
