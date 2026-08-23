// Identidad del agente (SPEC.md §9.1). Único módulo que la declara: el system
// prompt del servidor y los componentes de cliente consumen de aquí, para que
// el nombre nunca quede desalineado entre lo que dice la UI y lo que cree el
// modelo. No se declara como variable de entorno a propósito: sería visible
// solo en el servidor y la UI mostraría otro nombre.
export const agente = {
  nombre: "Toño",
  rol: "asesor de repuestos y servicio",
  firma: "Toño · asesor de repuestos y servicio",
} as const;
