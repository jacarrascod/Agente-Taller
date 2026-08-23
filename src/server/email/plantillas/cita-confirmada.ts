import { formatearFechaLarga, horaHMLima } from "../../lib/fechas";
import { formatearPEN } from "../../lib/moneda";
import { taller } from "../../lib/taller";
import { envolverHtml, envolverTexto } from "./_layout";

export interface DatosCitaConfirmada {
  codigo: string;
  nombreCliente: string;
  servicio: string;
  precio: number;
  duracionMinutos: number;
  inicio: Date;
}

export function plantillaCitaConfirmada(datos: DatosCitaConfirmada) {
  const fechaLarga = formatearFechaLarga(datos.inicio);
  const hora = horaHMLima(datos.inicio);
  const asunto = `Cita confirmada ${datos.codigo} — ${fechaLarga}, ${hora}`;

  const bloqueDestacado = {
    titulo: "Detalle de su cita",
    filas: [
      { etiqueta: "Código", valor: datos.codigo },
      { etiqueta: "Servicio", valor: datos.servicio },
      { etiqueta: "Fecha", valor: fechaLarga },
      { etiqueta: "Hora", valor: `${hora} h (hora de Lima)` },
      { etiqueta: "Duración", valor: `${datos.duracionMinutos} minutos` },
      { etiqueta: "Precio referencial", valor: formatearPEN(datos.precio) },
    ],
  };

  const parrafos = [
    `Su cita en ${taller.nombre} quedó registrada. Le dejamos el detalle a continuación.`,
    `<strong>Dirección:</strong> ${taller.direccion}. ${taller.referencia}. ` +
      `<a href="${taller.mapsUrl}" style="color:#EB0A1E;">Ver en Google Maps</a>.`,
    `<strong>Qué llevar:</strong> la tarjeta de propiedad del vehículo. Le pedimos llegar 10 minutos antes de la hora agendada.`,
    `<strong>¿Necesita cancelar?</strong> Puede responder este correo, llamarnos al ${taller.telefono} / WhatsApp ${taller.whatsapp}, o escribirle a Toño en el chat del sitio indicando este correo electrónico.`,
  ];

  const htmlContent = envolverHtml({
    preheader: `${datos.servicio} — ${fechaLarga}, ${hora} h`,
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos,
    bloqueDestacado,
    ctaTexto: "Ver mis citas",
    ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://toyotatallerperu.example"}/mis-citas`,
    notaFinal:
      "Si no encuentra este correo más adelante, revise también la carpeta de Promociones o Spam.",
  });

  const textContent = envolverTexto({
    saludo: `Hola, ${datos.nombreCliente}.`,
    parrafos: [
      `Su cita en ${taller.nombre} quedó registrada.`,
      `Dirección: ${taller.direccion}. ${taller.referencia}. Mapa: ${taller.mapsUrl}`,
      `Qué llevar: la tarjeta de propiedad del vehículo. Llegue 10 minutos antes.`,
      `¿Necesita cancelar? Responda este correo, llame al ${taller.telefono} / WhatsApp ${taller.whatsapp}, o escriba en el chat del sitio con este correo.`,
    ],
    bloqueDestacado,
  });

  return { asunto, htmlContent, textContent };
}
