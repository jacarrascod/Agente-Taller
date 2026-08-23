import { formatearFechaLarga, horaHMLima } from "../../lib/fechas";
import { envolverHtml, envolverTexto } from "./_layout";

export interface DatosCitaCancelada {
  codigo: string;
  nombreCliente: string;
  servicio: string;
  inicio: Date;
}

export function plantillaCitaCancelada(datos: DatosCitaCancelada) {
  const fechaLarga = formatearFechaLarga(datos.inicio);
  const hora = horaHMLima(datos.inicio);
  const asunto = `Cita ${datos.codigo} cancelada`;

  const bloqueDestacado = {
    titulo: "Cita cancelada",
    filas: [
      { etiqueta: "Código", valor: datos.codigo },
      { etiqueta: "Servicio", valor: datos.servicio },
      { etiqueta: "Fecha original", valor: fechaLarga },
      { etiqueta: "Hora original", valor: `${hora} h (hora de Lima)` },
    ],
  };

  const urlAgenda = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://toyotatallerperu.example"}/agenda`;

  const parrafos = [
    `Confirmamos que su cita quedó <strong>cancelada</strong>. El horario ya está disponible para otros clientes.`,
    `Cuando quiera reprogramar, con gusto lo ayudamos a buscar un nuevo espacio.`,
  ];

  const htmlContent = envolverHtml({
    preheader: `Cita ${datos.codigo} cancelada`,
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos,
    bloqueDestacado,
    ctaTexto: "Agendar una nueva cita",
    ctaUrl: urlAgenda,
  });

  const textContent = envolverTexto({
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos: [
      `Confirmamos que su cita quedó cancelada. El horario ya está disponible para otros clientes.`,
      `Cuando quiera reprogramar, agende en ${urlAgenda} o escríbale a Toño en el chat.`,
    ],
    bloqueDestacado,
  });

  return { asunto, htmlContent, textContent };
}
