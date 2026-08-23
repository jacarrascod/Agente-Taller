// Envío de correo transaccional vía Brevo (SPEC.md §11).
// Proveedor `consola` (EMAIL_PROVIDER=consola, default en desarrollo): no
// llama a Brevo, imprime el correo formateado en el log del servidor.

import "server-only";

export interface DestinatarioCorreo {
  email: string;
  nombre?: string;
}

export interface EnvioCorreo {
  destinatario: DestinatarioCorreo;
  asunto: string;
  htmlContent: string;
  textContent: string;
}

export interface ResultadoEnvioProveedor {
  ok: boolean;
  proveedorId?: string;
  error?: string;
}

function proveedor(): "brevo" | "consola" {
  const valor = (process.env.EMAIL_PROVIDER ?? "consola").toLowerCase();
  return valor === "brevo" ? "brevo" : "consola";
}

async function enviarConBrevo(correo: EnvioCorreo, intento = 1): Promise<ResultadoEnvioProveedor> {
  const apiKey = process.env.BREVO_API_KEY;
  const remitente = process.env.EMAIL_REMITENTE;
  if (!apiKey || !remitente) {
    return { ok: false, error: "CONFIGURACION_INCOMPLETA" };
  }

  const body: Record<string, unknown> = {
    sender: { name: process.env.EMAIL_REMITENTE_NOMBRE ?? "Toyota Taller Perú", email: remitente },
    to: [{ email: correo.destinatario.email, name: correo.destinatario.nombre ?? correo.destinatario.email }],
    subject: correo.asunto,
    htmlContent: correo.htmlContent,
    textContent: correo.textContent,
  };
  if (process.env.EMAIL_RESPONDER_A) body.replyTo = { email: process.env.EMAIL_RESPONDER_A };
  if (process.env.EMAIL_COPIA_TALLER) body.bcc = [{ email: process.env.EMAIL_COPIA_TALLER }];

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 3000);

  try {
    const respuesta = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controlador.signal,
    });

    if (respuesta.ok) {
      const data = (await respuesta.json()) as { messageId?: string };
      return { ok: true, proveedorId: data.messageId };
    }

    if (respuesta.status === 402) {
      return { ok: false, error: "LIMITE_DIARIO" };
    }

    // Reintento único ante 5xx; nunca ante 4xx (error de configuración/destinatario).
    if (respuesta.status >= 500 && intento === 1) {
      await new Promise((r) => setTimeout(r, 800));
      return enviarConBrevo(correo, 2);
    }

    const detalle = await respuesta.text().catch(() => "");
    return { ok: false, error: `HTTP_${respuesta.status}${detalle ? `: ${detalle}` : ""}` };
  } catch (error) {
    if (intento === 1) {
      await new Promise((r) => setTimeout(r, 800));
      return enviarConBrevo(correo, 2);
    }
    return { ok: false, error: error instanceof Error ? error.message : "ERROR_RED" };
  } finally {
    clearTimeout(timeout);
  }
}

function enviarPorConsola(correo: EnvioCorreo): ResultadoEnvioProveedor {
  console.log(
    `\n──── 📧 Correo (modo consola) ────\n` +
      `Para: ${correo.destinatario.nombre ?? ""} <${correo.destinatario.email}>\n` +
      `Asunto: ${correo.asunto}\n\n${correo.textContent}\n` +
      `───────────────────────────────────\n`,
  );
  return { ok: true, proveedorId: `consola-${Date.now()}` };
}

export async function enviarCorreo(correo: EnvioCorreo): Promise<ResultadoEnvioProveedor> {
  if (proveedor() === "consola") return enviarPorConsola(correo);
  return enviarConBrevo(correo);
}

export function proveedorActivo(): "brevo" | "consola" {
  return proveedor();
}
