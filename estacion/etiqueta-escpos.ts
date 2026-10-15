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

/** Ancho del papel de la POS que imprime la etiqueta (lib/impresion.ts lo agrega a la carga). */
interface ConPapel {
  anchoPapelMm?: 58 | 80 | null;
}

/** Puntos útiles del rollo: 384 en 58mm, 576 en 80mm. */
function puntosPapel(anchoMm?: number | null): number {
  return anchoMm === 58 ? 384 : 576;
}

/**
 * Achica la etiqueta (vecino más cercano, sin deformarla) si es más
 * ancha que el papel; si cabe, la deja igual. Una etiqueta de 55mm
 * (440 puntos) no entra en un rollo de 58mm y salía cortada.
 */
export function ajustarRaster(raster: EtiquetaRaster, maxDots: number): EtiquetaRaster {
  if (raster.anchoDots <= maxDots) return raster;
  const ancho = maxDots;
  const alto = Math.max(1, Math.round((raster.altoDots * ancho) / raster.anchoDots));
  const origen = Buffer.from(raster.datosBase64, "base64");
  const bytesOrigen = Math.ceil(raster.anchoDots / 8);
  const bytesDestino = Math.ceil(ancho / 8);
  const datos = Buffer.alloc(bytesDestino * alto);
  for (let y = 0; y < alto; y++) {
    const yo = Math.min(raster.altoDots - 1, Math.floor((y * raster.altoDots) / alto));
    for (let x = 0; x < ancho; x++) {
      const xo = Math.min(raster.anchoDots - 1, Math.floor((x * raster.anchoDots) / ancho));
      if (origen.readUInt8(yo * bytesOrigen + (xo >> 3)) & (0x80 >> (xo & 7))) {
        const i = y * bytesDestino + (x >> 3);
        datos.writeUInt8(datos.readUInt8(i) | (0x80 >> (x & 7)), i);
      }
    }
  }
  return { anchoDots: ancho, altoDots: alto, datosBase64: datos.toString("base64") };
}

function copias(n: number): number {
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : 1;
}

function repetir(una: Buffer, n: number): Buffer {
  return Buffer.concat(Array.from({ length: copias(n) }, () => una));
}

export function etiquetaRasterEscpos(original: EtiquetaRaster, n: number, anchoPapelMm?: number | null): Buffer {
  const raster = ajustarRaster(original, puntosPapel(anchoPapelMm));
  const una = componer(
    inicializar(),
    alinear("centro"),
    imagenRaster(raster.anchoDots, raster.altoDots, Buffer.from(raster.datosBase64, "base64")),
    salto(3),
    cortar(),
  );
  return repetir(una, n);
}

export function etiquetaQrEscpos(d: DatosEtiquetaQr & ConPapel): Buffer {
  return etiquetaRasterEscpos(d.etiquetaRaster, 1, d.anchoPapelMm);
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

export function etiquetaArticuloEscpos(d: DatosEtiquetaArticulo & ConPapel): Buffer {
  if (d.etiquetaRaster) return etiquetaRasterEscpos(d.etiquetaRaster, 1, d.anchoPapelMm);
  return etiquetaTexto([[d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo], d.codigo, 1);
}

export function etiquetaRepuestoEscpos(d: DatosEtiquetaRepuesto & ConPapel): Buffer {
  if (d.etiquetaRaster) return etiquetaRasterEscpos(d.etiquetaRaster, d.cantidadCopias, d.anchoPapelMm);
  return etiquetaTexto([d.nombreEmpresa, d.descripcion], d.codigo, d.cantidadCopias);
}
