// Formato compartido para componentes cliente. No importar nada de
// `src/server/**` desde el navegador — esta es la única fuente de verdad
// del lado cliente, aunque duplique la fórmula de src/server/lib/moneda.ts.

export function formatearPEN(monto: number): string {
  const formateado = new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
  return `S/ ${formateado}`;
}
