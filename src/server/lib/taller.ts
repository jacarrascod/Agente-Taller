// Datos fijos del taller (SPEC.md §3.1). Único módulo que los declara:
// system prompt, plantillas de correo, descripción del evento de Calendar
// y footer del sitio consumen de aquí. No se duplican como literales.

export const taller = {
  nombre: process.env.TALLER_NOMBRE ?? "Toyota Taller Perú",
  razonSocial: "Toyota Taller Perú S.A.C.",
  direccion:
    process.env.TALLER_DIRECCION ?? "Av. Javier Prado Este 4520, Santiago de Surco, Lima 15023",
  referencia:
    process.env.TALLER_REFERENCIA ?? "A media cuadra del óvalo Monitor Huáscar, frente al grifo Primax",
  telefono: process.env.TALLER_TELEFONO ?? "(01) 715-4820",
  whatsapp: process.env.TALLER_WHATSAPP ?? "+51 987 456 123",
  horario: "Lunes a viernes, 09:00 – 17:00. Sábados, domingos y feriados: cerrado",
  mapsUrl:
    process.env.TALLER_MAPS_URL ??
    "https://maps.google.com/?q=Av.+Javier+Prado+Este+4520,+Surco,+Lima",
} as const;

export const negocio = {
  zonaHoraria: process.env.TZ_TALLER ?? "America/Lima",
  horaApertura: Number(process.env.HORA_APERTURA ?? 9),
  horaCierre: Number(process.env.HORA_CIERRE ?? 17),
  duracionCitaMin: Number(process.env.DURACION_CITA_MIN ?? 60),
  diasLaborables: (process.env.DIAS_LABORABLES ?? "1,2,3,4,5")
    .split(",")
    .map((d) => Number(d.trim())),
  anticipacionMinimaHoras: Number(process.env.ANTICIPACION_MINIMA_HORAS ?? 2),
  ventanaAgendaDias: Number(process.env.VENTANA_AGENDA_DIAS ?? 30),
  igvPorcentaje: Number(process.env.IGV_PORCENTAJE ?? 18),
  envioCostoLima: Number(process.env.ENVIO_COSTO_LIMA ?? 15),
  envioGratisDesde: Number(process.env.ENVIO_GRATIS_DESDE ?? 300),
} as const;

export const disclaimerLegal =
  "Proyecto académico de demostración. No está afiliado, patrocinado ni avalado por Toyota Motor Corporation. Todos los datos de repuestos, precios, stock y mantenimientos son ficticios.";

export const distritosLimaConCobertura = [
  "Surco",
  "San Borja",
  "San Isidro",
  "Miraflores",
  "La Molina",
  "Surquillo",
  "Barranco",
  "San Miguel",
  "Magdalena del Mar",
  "Jesús María",
  "Lince",
  "Pueblo Libre",
  "San Juan de Miraflores",
  "Santa Anita",
  "Ate",
  "Los Olivos",
  "San Martín de Porres",
  "Comas",
  "Chorrillos",
  "Villa El Salvador",
] as const;
