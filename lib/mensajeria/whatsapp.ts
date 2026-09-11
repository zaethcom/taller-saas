/**
 * WhatsApp Business Platform (Cloud API) -- placeholder a propósito,
 * mismo patrón que lib/dian/proveedor.ts: la Fase de mensajería exige
 * decidir/crear la cuenta de Meta Business antes de escribir código
 * real de envío.
 *
 * Por qué la Cloud API y no automatizar un WhatsApp normal (Baileys /
 * whatsapp-web.js) desde la estación Android: la automatización NO
 * oficial simula una sesión de WhatsApp Web logueada con un número
 * real, y Meta detecta y banea esas sesiones -- el número quemado
 * puede ser el número real de la tienda. La Cloud API es la vía
 * soportada: una llamada HTTPS servidor-a-servidor, sin ningún
 * WhatsApp "instalado" en ningún dispositivo. La tablet o el técnico
 * nunca abren WhatsApp -- aprietan un botón en esta app y el backend
 * llama a la API de Meta directamente.
 *
 * Qué hace falta para activar esto (decisión de negocio, no de código):
 *   1. Cuenta de Meta Business verificada (business.facebook.com).
 *   2. Un número de WhatsApp Business Platform -- puede ser un número
 *      nuevo, no necesita tener la app de WhatsApp instalada en ningún
 *      celular. Para el "segundo WhatsApp" que pide el documento (para
 *      celulares recibidos sin WhatsApp propio) NO hace falta un
 *      segundo servidor ni un segundo Android: es un segundo
 *      phone_number_id bajo la misma cuenta de Meta Business.
 *   3. Una plantilla de mensaje aprobada por Meta para el primer
 *      contacto (fuera de la ventana de 24h de conversación abierta
 *      por el cliente, todo mensaje debe ser una plantilla aprobada).
 *   4. WHATSAPP_TOKEN (token de acceso permanente) y WHATSAPP_PHONE_ID
 *      en las variables de entorno -- exactamente igual que RESEND_API_KEY.
 *
 * Cuando eso exista, esta es la ÚNICA pieza que cambia: implementar
 * ProveedorWhatsapp contra la Graph API de Meta y exportarla aquí.
 */
import {
  WhatsappNoConfiguradoError,
  type DatosNotificacion,
  type ProveedorWhatsapp,
} from "./interfaz";

class ProveedorPendiente implements ProveedorWhatsapp {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async enviar(datos: DatosNotificacion): Promise<void> {
    throw new WhatsappNoConfiguradoError();
  }
}

export const proveedorWhatsapp: ProveedorWhatsapp = new ProveedorPendiente();
