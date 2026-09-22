/**
 * Qué impresora recibe cada trabajo.
 *
 * Vive aparte de index.ts porque index.ts arranca el bucle al
 * importarse: dejarlo ahí obligaría a levantar la estación entera para
 * probar el ruteo, que es justo la parte que más se equivoca.
 *
 * Las etiquetas salen SIEMPRE por la impresora de etiquetas, en PPLB
 * (ver estacion/etiqueta.ts). Una versión anterior de esta rama las
 * mandaba en ESC/POS por la impresora de tickets, partiendo de que la
 * sede no iba a comprar una etiquetadora; desde entonces la sede tiene
 * una Argox SAT-TT448USP y su lenguaje está confirmado contra el
 * dispositivo, así que ese camino se eliminó en vez de quedar como
 * respaldo: mandar PPLB a una impresora de recibos no falla con un
 * error, saca papel con basura.
 */
import { componer, inicializar, abrirCajon as abrirCajonBytes, pitido } from "./escpos";
import {
  etiquetaArticuloPplb,
  etiquetaQrPplb,
  etiquetaRepuestoPplb,
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

/** Traduce un trabajo pendiente a lo que hay que enviarle a cuál impresora. */
export function resolverImpresion(
  trabajo: TrabajoPendiente,
): { destino: "tickets" | "etiquetas"; contenido: Buffer | string } {
  switch (trabajo.tipo) {
    case "recibo_venta":
      return {
        destino: "tickets",
        contenido: componer(reciboVenta(trabajo.carga as CargaReciboVenta), pitido()),
      };

    case "comprobante_recepcion":
      return {
        destino: "tickets",
        contenido: componer(
          comprobanteRecepcion(trabajo.carga as CargaComprobanteRecepcion),
          pitido(),
        ),
      };

    case "cierre_caja":
      return {
        destino: "tickets",
        contenido: componer(cierreCaja(trabajo.carga as CargaCierreCaja), pitido()),
      };

    case "comprobante_traslado":
      return {
        destino: "tickets",
        contenido: componer(
          comprobanteTraslado(trabajo.carga as CargaComprobanteTraslado),
          pitido(),
        ),
      };

    case "abrir_cajon":
      return { destino: "tickets", contenido: componer(inicializar(), abrirCajonBytes()) };

    case "etiqueta_qr":
      return { destino: "etiquetas", contenido: etiquetaQrPplb(trabajo.carga as DatosEtiquetaQr) };

    case "etiqueta_articulo":
      return {
        destino: "etiquetas",
        contenido: etiquetaArticuloPplb(trabajo.carga as DatosEtiquetaArticulo),
      };

    case "etiqueta_repuesto":
      return {
        destino: "etiquetas",
        contenido: etiquetaRepuestoPplb(trabajo.carga as DatosEtiquetaRepuesto),
      };
  }
}
