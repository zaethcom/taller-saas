/**
 * Punto único desde el que el resto del proyecto avisa al cliente --
 * hoy solo se llama al recibir un equipo, pero es el mismo lugar al
 * que engancha, más adelante, la cotización lista o la entrega.
 *
 * Ningún canal puede tumbar el flujo que lo llama: recibir un equipo
 * (o cualquier otro evento) no debe fallar porque el correo o el
 * WhatsApp fallen. Por eso cada envío va en su propio try/catch y el
 * error queda en consola -- suficiente para depurar en el piloto, sin
 * bloquear al cajero ni al técnico.
 */
import { proveedorCorreo } from "./correo";
import { proveedorWhatsapp } from "./whatsapp";
import type { DatosNotificacion } from "./interfaz";

export async function notificarCliente(datos: DatosNotificacion): Promise<void> {
  await Promise.allSettled([
    proveedorCorreo.enviar(datos).catch((e) => {
      console.error("[mensajeria/correo]", e instanceof Error ? e.message : e);
    }),
    proveedorWhatsapp.enviar(datos).catch((e) => {
      console.error("[mensajeria/whatsapp]", e instanceof Error ? e.message : e);
    }),
  ]);
}
