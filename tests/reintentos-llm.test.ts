import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";

// runtime.ts arrastra persistencia (Supabase) y las tools (servicios con
// integraciones externas). Para probar solo la clasificación de errores se
// sustituyen por mocks vacíos: no se ejecuta ningún turno.
vi.mock("@/server/agent/persistencia", () => ({}));
vi.mock("@/server/agent/tools", () => ({
  NOMBRES_TOOLS: [],
  TOOLS_JSON_SCHEMA: [],
  ejecutarTool: vi.fn(),
}));

const { esErrorReintentable } = await import("@/server/agent/runtime");

describe("esErrorReintentable", () => {
  it("reintenta un APIError sin status (error a mitad del stream, p. ej. ia-gateway)", () => {
    // Así lo construye el SDK al recibir un evento de error dentro del SSE.
    const error = new OpenAI.APIError(
      undefined,
      { code: "upstream_error", message: "fallo del proveedor" },
      undefined,
      undefined,
    );
    expect(error.status).toBeUndefined();
    expect(esErrorReintentable(error)).toBe(true);
  });

  it("reintenta un APIConnectionError", () => {
    expect(esErrorReintentable(new OpenAI.APIConnectionError({ message: "Connection error." }))).toBe(true);
  });

  it("no reintenta un BadRequestError (400)", () => {
    const error = new OpenAI.BadRequestError(
      400,
      { code: "unsupported_parameter", param: "tools", message: "tools no soportado" },
      undefined,
      new Headers(),
    );
    expect(esErrorReintentable(error)).toBe(false);
  });

  it("no reintenta un error que no es del SDK", () => {
    expect(esErrorReintentable(new Error("otra cosa"))).toBe(false);
  });
});
