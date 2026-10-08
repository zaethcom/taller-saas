/**
 * Traducir un trabajo de la cola a los bytes exactos que van a la
 * impresora, y a cuál de las dos. Sin red ni archivos: lo usan la
 * estación (index.ts) y la web (GET /api/impresion/pendientes?formato=bytes,
 * para la app Android del puente, que imprime sin estación en medio).
 * Que sea el mismo código en los dos lados es lo que garantiza que una
 * etiqueta sale igual venga por donde venga.
 */
import { componer, inicializar, abrirCajon as abrirCajonBytes, pitido } from "./escpos";
import {
  etiquetaArticuloPplb,
  etiquetaQrPplb,
  etiquetaRasterPplb,
  etiquetaRepuestoPplb,
  type DatosEtiquetaArticulo,
  type DatosEtiquetaQr,
  type DatosEtiquetaRepuesto,
} from "./etiqueta";
import { etiquetaArticuloZpl, etiquetaQrZpl, etiquetaRasterZpl, etiquetaRepuestoZpl } from "./etiqueta-zpl";
import type { LenguajeEtiquetas } from "./destino";
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

/** ZPL va en UTF-8 (^CI28) para que salgan tildes; un string suelto se mandaría como ASCII. */
function zpl(texto: string): Buffer {
  return Buffer.from(texto, "utf-8");
}

/**
 * Traduce un trabajo pendiente a lo que hay que enviarle a cuál impresora.
 * Las etiquetas salen en PPLB (Argox) o ZPL (Zebra) según lo que se
 * eligió para esta sede en Configurar impresoras.
 */
export function resolverImpresion(
  trabajo: TrabajoPendiente,
  lenguaje: LenguajeEtiquetas = "pplb",
): { destino: "tickets" | "etiquetas"; contenido: Buffer | string } {
  const esZpl = lenguaje === "zpl";
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
      return {
        destino: "etiquetas",
        contenido: esZpl
          ? zpl(etiquetaQrZpl(trabajo.carga as DatosEtiquetaQr))
          : etiquetaQrPplb(trabajo.carga as DatosEtiquetaQr),
      };

    // Con plantilla activa en la web, la carga trae la etiqueta ya
    // dibujada (`etiquetaRaster`); sin ella, la de fábrica con comandos nativos.
    case "etiqueta_articulo": {
      const carga = trabajo.carga as DatosEtiquetaArticulo;
      return {
        destino: "etiquetas",
        contenido: esZpl
          ? zpl(carga.etiquetaRaster ? etiquetaRasterZpl(carga.etiquetaRaster, 1) : etiquetaArticuloZpl(carga))
          : carga.etiquetaRaster
            ? etiquetaRasterPplb(carga.etiquetaRaster, 1)
            : etiquetaArticuloPplb(carga),
      };
    }

    case "etiqueta_repuesto": {
      const carga = trabajo.carga as DatosEtiquetaRepuesto;
      return {
        destino: "etiquetas",
        contenido: esZpl
          ? zpl(
              carga.etiquetaRaster
                ? etiquetaRasterZpl(carga.etiquetaRaster, carga.cantidadCopias)
                : etiquetaRepuestoZpl(carga),
            )
          : carga.etiquetaRaster
            ? etiquetaRasterPplb(carga.etiquetaRaster, carga.cantidadCopias)
            : etiquetaRepuestoPplb(carga),
      };
    }
  }
}

/**
 * Lo que de verdad viaja por el cable. Las etiquetas PPLB salen como
 * texto y se mandan en ASCII -- igual que hace estacion/destino.ts (las
 * ZPL ya salen como Buffer UTF-8 de resolverImpresion).
 */
export function aBytes(contenido: Buffer | string): Buffer {
  return typeof contenido === "string" ? Buffer.from(contenido, "ascii") : contenido;
}
