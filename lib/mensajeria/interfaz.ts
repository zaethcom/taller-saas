/**
 * Contrato común para avisar al cliente que su equipo entró (o cambió
 * de estado): un enlace de seguimiento, por dos canales independientes.
 *
 * Ningún canal debe poder tumbar la recepción de un equipo. Por eso
 * notificarCliente() (en notificar.ts) nunca deja que un error de aquí
 * suba hasta la ruta que crea la orden -- como mucho, queda registrado.
 */
export interface DatosNotificacion {
  clienteNombre: string;
  clienteTelefono?: string | null;
  clienteCorreo?: string | null;
  numeroOrden: number;
  producto: string;
  urlSeguimiento: string;
  /** true si el equipo es un teléfono celular sin WhatsApp propio disponible. */
  usarWhatsappSecundario?: boolean;
}

export interface ProveedorCorreo {
  enviar(datos: DatosNotificacion): Promise<void>;
}

export interface ProveedorWhatsapp {
  enviar(datos: DatosNotificacion): Promise<void>;
}

export class CorreoNoConfiguradoError extends Error {
  constructor() {
    super("El envío de correo no está configurado (falta RESEND_API_KEY).");
    this.name = "CorreoNoConfiguradoError";
  }
}

export class WhatsappNoConfiguradoError extends Error {
  constructor() {
    super(
      "El envío por WhatsApp no está configurado todavía -- falta crear la " +
        "cuenta de WhatsApp Business Platform y completar WHATSAPP_TOKEN / " +
        "WHATSAPP_PHONE_ID en las variables de entorno.",
    );
    this.name = "WhatsappNoConfiguradoError";
  }
}
