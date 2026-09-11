/**
 * Correo transaccional vía Resend -- decidido sobre WhatsApp-only porque
 * no depende de ninguna verificación de negocio para empezar a enviar y
 * porque Next.js/Vercel lo integran de forma nativa (no hay SMTP que
 * mantener). Capa gratuita: 3000 correos/mes.
 *
 * Igual que con la DIAN, esto vive detrás de una interfaz (ProveedorCorreo)
 * para que cambiar de proveedor el día de mañana sea reemplazar este único
 * archivo.
 */
import { Resend } from "resend";
import {
  CorreoNoConfiguradoError,
  type DatosNotificacion,
  type ProveedorCorreo,
} from "./interfaz";

class ProveedorResend implements ProveedorCorreo {
  async enviar(datos: DatosNotificacion): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const remitente = process.env.RESEND_FROM;
    if (!apiKey || !remitente) {
      throw new CorreoNoConfiguradoError();
    }
    if (!datos.clienteCorreo) return;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: remitente,
      to: datos.clienteCorreo,
      subject: `Recibimos tu equipo -- orden #${datos.numeroOrden}`,
      html: `
        <p>Hola ${datos.clienteNombre},</p>
        <p>Recibimos tu equipo (<strong>${datos.producto}</strong>) con el
        número de orden <strong>#${datos.numeroOrden}</strong>.</p>
        <p>Puedes consultar el estado de tu proceso, y aprobar la
        cotización cuando esté lista, en este enlace:</p>
        <p><a href="${datos.urlSeguimiento}">${datos.urlSeguimiento}</a></p>
      `,
    });
    if (error) {
      throw new Error(`Resend rechazó el envío: ${error.message}`);
    }
  }
}

export const proveedorCorreo: ProveedorCorreo = new ProveedorResend();
