/**
 * Qué impresora recibe cada trabajo, y en qué lenguaje.
 *
 * Vive aparte de index.ts porque index.ts arranca el bucle al
 * importarse: dejarlo ahí obligaría a levantar la estación entera para
 * probar el ruteo, que es justo la parte que más se equivoca.
 */
import { componer, inicializar, abrirCajon as abrirCajonBytes } from "./escpos";
import {
  etiquetaArticuloTicket,
  etiquetaArticuloZpl,
  etiquetaQrTicket,
  etiquetaQrZpl,
  etiquetaRepuestoTicket,
  etiquetaRepuestoZpl,
  type DatosEtiquetaArticulo,
  type DatosEtiquetaQr,
  type DatosEtiquetaRepuesto,
} from "./etiqueta";
import { reciboVenta, type CargaReciboVenta } from "./plantillas/recibo";
import { comprobanteRecepcion, type CargaComprobanteRecepcion } from "./plantillas/comprobante";
import { cierreCaja, type CargaCierreCaja } from "./plantillas/cierre";
import { comprobanteTraslado, type CargaComprobanteTraslado } from "./plantillas/traslado";

export interface TrabajoPendiente {
  id: string;
  tipo:
    | "etiqueta_qr"
    | "recibo_venta"
    | "comprobante_recepcion"
    | "cierre_caja"
    | "abrir_cajon"
    | "comprobante_traslado"
    | "etiqueta_articulo"
    | "etiqueta_repuesto";
  carga: unknown;
}

/**
 * Traduce un trabajo pendiente a lo que hay que enviarle a cuál impresora.
 *
 * `hayEtiquetadora` sale de la configuración de impresoras de la sede
 * (la de la web, o el config.json local), no de un flag en el código:
 * sin una impresora `etiquetas` configurada -- que es el caso de todas
 * las sedes hoy -- las etiquetas se imprimen en ESC/POS por la
 * impresora de tickets. Con una etiquetadora conectada salen en ZPL por
 * la suya, sin tocar nada más.
 *
 * Mandar ZPL a una impresora de recibos no falla con un error: saca
 * papel con basura, o no saca nada. Por eso la decisión vive aquí y no
 * en quien encola el trabajo.
 */
export function resolverImpresion(
  trabajo: TrabajoPendiente,
  hayEtiquetadora: boolean,
): { destino: "tickets" | "etiquetas"; contenido: Buffer | string } {
  switch (trabajo.tipo) {
    case "recibo_venta":
      return { destino: "tickets", contenido: reciboVenta(trabajo.carga as CargaReciboVenta) };

    case "comprobante_recepcion":
      return {
        destino: "tickets",
        contenido: comprobanteRecepcion(trabajo.carga as CargaComprobanteRecepcion),
      };

    case "cierre_caja":
      return { destino: "tickets", contenido: cierreCaja(trabajo.carga as CargaCierreCaja) };

    case "comprobante_traslado":
      return {
        destino: "tickets",
        contenido: comprobanteTraslado(trabajo.carga as CargaComprobanteTraslado),
      };

    case "abrir_cajon":
      return { destino: "tickets", contenido: componer(inicializar(), abrirCajonBytes()) };

    case "etiqueta_qr": {
      const carga = trabajo.carga as DatosEtiquetaQr;
      return hayEtiquetadora
        ? { destino: "etiquetas", contenido: etiquetaQrZpl(carga) }
        : { destino: "tickets", contenido: etiquetaQrTicket(carga) };
    }

    case "etiqueta_articulo": {
      const carga = trabajo.carga as DatosEtiquetaArticulo;
      return hayEtiquetadora
        ? { destino: "etiquetas", contenido: etiquetaArticuloZpl(carga) }
        : { destino: "tickets", contenido: etiquetaArticuloTicket(carga) };
    }

    case "etiqueta_repuesto": {
      const carga = trabajo.carga as DatosEtiquetaRepuesto;
      return hayEtiquetadora
        ? { destino: "etiquetas", contenido: etiquetaRepuestoZpl(carga) }
        : { destino: "tickets", contenido: etiquetaRepuestoTicket(carga) };
    }
  }
}
