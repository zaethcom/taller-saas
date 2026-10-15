/**
 * Etiquetas en la impresora POS de tickets (ESC/POS), para la sede que no
 * tiene etiquetadora: sin esto, los comandos PPLB/ZPL le llegan a la POS
 * y los imprime como texto (una tira de «N GW0,0,30,200…» y basura).
 *
 * La etiqueta dibujada en el servidor (QR + código + marco, o la
 * plantilla de la empresa) sale como imagen con GS v 0, igual que el logo
 * del recibo: el bitmap ya viene con 1 = punto negro, que es lo que espera
 * ESC/POS. Sin plantilla, el artículo/repuesto sale en texto con su
 * código en QR. Cada copia va con su corte.
 */
import { alinear, componer, cortar, imagenRaster, inicializar, negrita, qr, salto, texto } from "./escpos";
import type {
  DatosEtiquetaArticulo,
  DatosEtiquetaQr,
  DatosEtiquetaRepuesto,
  EtiquetaRaster,
} from "./etiqueta";

function copias(n: number): number {
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : 1;
}

function repetir(una: Buffer, n: number): Buffer {
  return Buffer.concat(Array.from({ length: copias(n) }, () => una));
}

export function etiquetaRasterEscpos(raster: EtiquetaRaster, n: number): Buffer {
  const una = componer(
    inicializar(),
    alinear("centro"),
    imagenRaster(raster.anchoDots, raster.altoDots, Buffer.from(raster.datosBase64, "base64")),
    salto(3),
    cortar(),
  );
  return repetir(una, n);
}

export function etiquetaQrEscpos(d: DatosEtiquetaQr): Buffer {
  return etiquetaRasterEscpos(d.etiquetaRaster, 1);
}

function etiquetaTexto(lineas: string[], codigo: string, n: number): Buffer {
  const una = componer(
    inicializar(),
    alinear("centro"),
    negrita(true),
    texto(`${codigo}\n`),
    negrita(false),
    ...lineas.filter(Boolean).map((l) => texto(`${l}\n`)),
    qr(codigo),
    salto(3),
    cortar(),
  );
  return repetir(una, n);
}

export function etiquetaArticuloEscpos(d: DatosEtiquetaArticulo): Buffer {
  if (d.etiquetaRaster) return etiquetaRasterEscpos(d.etiquetaRaster, 1);
  return etiquetaTexto([[d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo], d.codigo, 1);
}

export function etiquetaRepuestoEscpos(d: DatosEtiquetaRepuesto): Buffer {
  if (d.etiquetaRaster) return etiquetaRasterEscpos(d.etiquetaRaster, d.cantidadCopias);
  return etiquetaTexto([d.nombreEmpresa, d.descripcion], d.codigo, d.cantidadCopias);
}
