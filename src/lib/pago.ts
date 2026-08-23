// Validación de tarjeta 100% en el cliente (SPEC.md §14). El PAN
// completo, el CVV y el vencimiento NUNCA se envían al servidor: solo se
// transmiten los últimos 4 dígitos junto con una referencia de pago.

export function esNumeroTarjetaValido(numero: string): boolean {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.length < 13 || digitos.length > 19) return false;
  let suma = 0;
  let doblar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = Number(digitos[i]);
    if (doblar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doblar = !doblar;
  }
  return suma % 10 === 0;
}

export function esVencimientoValido(mm: string, aa: string): boolean {
  const mes = Number(mm);
  const anio = Number(aa);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return false;
  if (!Number.isInteger(anio)) return false;
  const anioCompleto = anio < 100 ? 2000 + anio : anio;
  const finDeMes = Date.UTC(anioCompleto, mes, 1);
  return finDeMes > Date.now();
}

export function esCvvValido(cvv: string): boolean {
  return /^\d{3}$/.test(cvv);
}

export type ResultadoPagoDemo =
  | { aprobado: true }
  | { aprobado: false; motivo: string };

const TARJETAS_PRUEBA: Record<string, ResultadoPagoDemo> = {
  "4111111111111111": { aprobado: true },
  "4000000000000002": { aprobado: false, motivo: "Fondos insuficientes" },
  "4000000000000069": { aprobado: false, motivo: "Tarjeta vencida" },
};

/** Simula la respuesta de la pasarela: nunca contacta a un tercero real. */
export function evaluarTarjetaDemo(numero: string): ResultadoPagoDemo {
  const digitos = numero.replace(/\D/g, "");
  if (TARJETAS_PRUEBA[digitos]) return TARJETAS_PRUEBA[digitos];
  return { aprobado: true };
}

export function generarReferenciaPagoDemo(): string {
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `DEMO-TXN-${hex.toUpperCase()}`;
}
