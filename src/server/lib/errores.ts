// Error de dominio uniforme para toda la API HTTP y las tools del agente
// (SPEC.md §12): { error: { codigo, mensaje, detalle? } }.

import { ZodError } from "zod";
import type { ErrorDominio } from "@/types/dominio";

export class ErrorAplicacion extends Error {
  codigo: ErrorDominio["codigo"];
  detalle?: unknown;
  status: number;

  constructor(codigo: ErrorDominio["codigo"], mensaje: string, status = 400, detalle?: unknown) {
    super(mensaje);
    this.name = "ErrorAplicacion";
    this.codigo = codigo;
    this.status = status;
    this.detalle = detalle;
  }

  toJSON(): { error: ErrorDominio } {
    return { error: { codigo: this.codigo, mensaje: this.message, detalle: this.detalle } };
  }
}

export function respuestaError(error: unknown): { body: { error: ErrorDominio }; status: number } {
  if (error instanceof ErrorAplicacion) {
    return { body: error.toJSON(), status: error.status };
  }
  // DEF-01: un ZodError es un error de entrada del cliente (400), no un
  // fallo del servidor (500). El detalle de `issues` ayuda a corregir el
  // campo exacto sin exponer trazas internas.
  if (error instanceof ZodError) {
    return {
      body: {
        error: {
          codigo: "DATOS_INVALIDOS",
          mensaje: "Los datos enviados no son válidos.",
          detalle: error.issues.map((i) => ({ campo: i.path.join("."), problema: i.message })),
        },
      },
      status: 400,
    };
  }
  const mensaje = error instanceof Error ? error.message : "Error desconocido";
  return {
    body: { error: { codigo: "ERROR_DESCONOCIDO", mensaje } },
    status: 500,
  };
}
