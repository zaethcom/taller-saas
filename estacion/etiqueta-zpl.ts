/**
 * Las mismas etiquetas de estacion/etiqueta.ts, pero en ZPL, para cuando
 * la etiquetadora de la sede es una Zebra (caso real: ZP 500 en Local 1)
 * en vez de la Argox que habla PPLB. Se elige por sede desde
 * Configurar impresoras («Idioma de la etiquetadora»); la web no sabe
 * nada de esto, solo guarda la opción y la estación la usa.
 *
 * - Las etiquetas ya dibujadas en el servidor (la de la orden, o las de
 *   artículo/repuesto con plantilla activa) van como una sola imagen con
 *   `^GFA`. El bitmap llega con 1 = punto negro, que es justo lo que
 *   espera ZPL, así que no hay que invertir nada.
 * - Sin plantilla, artículo y repuesto salen con texto y Code128 nativos.
 *
 * Sin confirmar todavía en papel real: márgenes y orientación. A
 * diferencia de la Argox (que necesitó rotación 180°), aquí se manda en
 * orientación normal; si sale al revés, `^POI` en ENCABEZADO lo gira.
 */
import type {
  DatosEtiquetaArticulo,
  DatosEtiquetaQr,
  DatosEtiquetaRepuesto,
  EtiquetaRaster,
} from "./etiqueta";

/** ^CI28: el texto va en UTF-8, para que salgan tildes y eñes. */
const ENCABEZADO = "^XA^CI28";

/** `^` y `~` son caracteres de comando en ZPL: dentro de un campo se cambian por espacio. */
function escapar(s: string): string {
  return s.replace(/[\^~]/g, " ");
}

function copiasValidas(copias: number): number {
  return Number.isInteger(copias) && copias > 0 ? copias : 1;
}

/** `^GFA,<bytes totales>,<bytes totales>,<bytes por fila>,<datos en hex>` */
function imagenGfa(raster: EtiquetaRaster): string {
  const anchoBytes = Math.ceil(raster.anchoDots / 8);
  const datos = Buffer.from(raster.datosBase64, "base64");
  return `^GFA,${datos.length},${datos.length},${anchoBytes},${datos.toString("hex").toUpperCase()}`;
}

/** Cualquier etiqueta ya dibujada como bitmap en el servidor. `^PQ` repite la misma imagen. */
export function etiquetaRasterZpl(raster: EtiquetaRaster, copias: number): string {
  return [
    ENCABEZADO,
    `^PW${raster.anchoDots}`,
    `^LL${raster.altoDots}`,
    `^FO0,0${imagenGfa(raster)}^FS`,
    `^PQ${copiasValidas(copias)}`,
    "^XZ",
  ].join("\r\n");
}

export function etiquetaQrZpl(d: DatosEtiquetaQr): string {
  return etiquetaRasterZpl(d.etiquetaRaster, 1);
}

export function etiquetaArticuloZpl(d: DatosEtiquetaArticulo): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;
  return [
    ENCABEZADO,
    `^FO20,15^A0N,30,30^FD${escapar(d.codigo)}^FS`,
    `^FO20,50^A0N,26,26^FD${escapar(linea2)}^FS`,
    `^FO20,90^BY2^BCN,60,N,N,N^FD${escapar(d.codigo)}^FS`,
    "^PQ1",
    "^XZ",
  ].join("\r\n");
}

export function etiquetaRepuestoZpl(d: DatosEtiquetaRepuesto): string {
  return [
    ENCABEZADO,
    `^FO20,15^A0N,26,26^FD${escapar(d.nombreEmpresa)}^FS`,
    `^FO20,50^BY2^BCN,80,N,N,N^FD${escapar(d.codigo)}^FS`,
    `^FO20,145^A0N,26,26^FD${escapar(d.descripcion)}^FS`,
    `^PQ${copiasValidas(d.cantidadCopias)}`,
    "^XZ",
  ].join("\r\n");
}
