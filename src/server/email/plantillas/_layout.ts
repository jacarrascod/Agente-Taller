// Layout HTML compartido por las 3 plantillas (SPEC.md §11.3).
// Una sola columna, máximo 600px, tablas anidadas (no flexbox/grid),
// estilos en línea, sin imágenes ni fuentes externas. Franja roja
// superior, cuerpo blanco, pie gris. El logo se dibuja con texto.

import { disclaimerLegal, taller } from "../../lib/taller";

export interface BloqueDestacado {
  titulo: string;
  filas: { etiqueta: string; valor: string }[];
}

export function envolverHtml(opciones: {
  preheader: string;
  saludo: string;
  parrafos: string[];
  bloqueDestacado?: BloqueDestacado;
  ctaTexto?: string;
  ctaUrl?: string;
  notaFinal?: string;
}): string {
  const { preheader, saludo, parrafos, bloqueDestacado, ctaTexto, ctaUrl, notaFinal } = opciones;

  const filasBloque = bloqueDestacado
    ? bloqueDestacado.filas
        .map(
          (f) => `
      <tr>
        <td style="padding:4px 0;color:#6E6E73;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${f.etiqueta}</td>
        <td style="padding:4px 0;color:#0F0F10;font-size:14px;font-family:Arial,Helvetica,sans-serif;text-align:right;font-weight:700;">${f.valor}</td>
      </tr>`,
        )
        .join("")
    : "";

  const bloqueHtml = bloqueDestacado
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;border-radius:12px;margin:24px 0;">
      <tr><td style="padding:20px 24px;">
        <div style="color:#0F0F10;font-size:15px;font-weight:700;font-family:Arial,Helvetica,sans-serif;margin-bottom:8px;">${bloqueDestacado.titulo}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filasBloque}</table>
      </td></tr>
    </table>`
    : "";

  const ctaHtml =
    ctaTexto && ctaUrl
      ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#EB0A1E;border-radius:8px;">
        <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">${ctaTexto}</a>
      </td></tr>
    </table>`
      : "";

  const parrafosHtml = parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;color:#1C1C1E;font-size:15px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${p}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${taller.nombre}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#EB0A1E;padding:20px 24px;">
    <span style="color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.5px;">TTP · ${taller.nombre}</span>
  </td></tr>
  <tr><td style="padding:32px 24px;">
    <p style="margin:0 0 16px 0;color:#0F0F10;font-size:16px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">${saludo}</p>
    ${parrafosHtml}
    ${bloqueHtml}
    ${ctaHtml}
    ${notaFinal ? `<p style="margin:24px 0 0 0;color:#6E6E73;font-size:13px;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">${notaFinal}</p>` : ""}
  </td></tr>
  <tr><td style="background:#F5F5F7;padding:24px;border-top:1px solid #D6D6D8;">
    <p style="margin:0 0 4px 0;color:#1C1C1E;font-size:13px;font-family:Arial,Helvetica,sans-serif;font-weight:700;">${taller.nombre}</p>
    <p style="margin:0 0 4px 0;color:#6E6E73;font-size:12px;font-family:Arial,Helvetica,sans-serif;">${taller.direccion} — ${taller.referencia}</p>
    <p style="margin:0 0 4px 0;color:#6E6E73;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Tel: ${taller.telefono} · WhatsApp: ${taller.whatsapp}</p>
    <p style="margin:12px 0 0 0;color:#8A8A8E;font-size:11px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;">${disclaimerLegal}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function envolverTexto(opciones: {
  saludo: string;
  parrafos: string[];
  bloqueDestacado?: BloqueDestacado;
  notaFinal?: string;
}): string {
  const { saludo, parrafos, bloqueDestacado, notaFinal } = opciones;
  const lineasBloque = bloqueDestacado
    ? [
        "",
        bloqueDestacado.titulo,
        ...bloqueDestacado.filas.map((f) => `- ${f.etiqueta}: ${f.valor}`),
        "",
      ]
    : [];
  return [
    saludo,
    "",
    ...parrafos,
    ...lineasBloque,
    notaFinal ? "" : "",
    notaFinal ?? "",
    "",
    `${taller.nombre}`,
    `${taller.direccion} — ${taller.referencia}`,
    `Tel: ${taller.telefono} · WhatsApp: ${taller.whatsapp}`,
    "",
    disclaimerLegal,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}
