/**
 * Convierte el logo de una empresa (el que ya sube en /configuracion,
 * cualquier formato: PNG, JPEG, WebP) en un bitmap monocromático listo
 * para imprimir -- la estación nunca decodifica imágenes ni sabe qué
 * es un PNG, solo empaqueta bytes ya resueltos (mismo principio que el
 * resto de `carga` en lib/impresion.ts). `sharp` vive en el servidor,
 * no en estacion/, a propósito: ese paquete corre en Android/Termux, y
 * una dependencia con binarios nativos ahí es un dolor de cabeza real
 * -- aquí, en Vercel/Node, es una dependencia normal.
 *
 * El tamaño objetivo lo decide quien llama: el recibo de 80mm tiene
 * mucho más espacio que la etiqueta de 50x30mm, así que cada uno pide
 * el suyo (ver TAMANO_RECIBO / TAMANO_ETIQUETA más abajo). Si en el
 * papel real se ve chico o grande, son los únicos números que hay que
 * tocar.
 */
import sharp from "sharp";

// 96 puntos = 12mm de alto: antes eran 160 (20mm) y el logo solo se
// comía casi un tercio del recibo de venta.
// lienzoDots: el ancho total del bitmap con el logo centrado adentro.
// 480 = el área de impresión que fija estacion/escpos.ts:areaImpresion
// (40 letras de 12 puntos); un lienzo más ancho se saldría de esa área.
export const TAMANO_RECIBO = { anchoDots: 384, altoMaximoDots: 96, lienzoDots: 480 };
// Rollo de 58mm: 384 puntos útiles en total.
export const TAMANO_RECIBO_58 = { anchoDots: 320, altoMaximoDots: 80, lienzoDots: 384 };
export const TAMANO_ETIQUETA = { anchoDots: 200, altoMaximoDots: 50 };

export interface LogoRaster {
  anchoDots: number;
  altoDots: number;
  datosBase64: string;
}

export async function generarLogoRaster(
  logoUrl: string | null | undefined,
  tamano: { anchoDots: number; altoMaximoDots: number; lienzoDots?: number } = TAMANO_RECIBO,
): Promise<LogoRaster | null> {
  if (!logoUrl) return null;

  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());

    // Sin transparencia (el papel térmico no tiene "detrás") y sin los
    // bordes en blanco que traiga la imagen subida: si el logo viene con
    // más margen a un lado, en el papel se veía corrido del centro.
    const recortado = await sharp(original)
      .flatten({ background: "#ffffff" })
      .trim({ background: "#ffffff", threshold: 20 })
      .resize({ width: tamano.anchoDots, height: tamano.altoMaximoDots, fit: "inside" })
      .png()
      .toBuffer({ resolveWithObject: true });

    // Centrado dentro del propio bitmap, no solo con ESC a: hay
    // impresoras que ignoran la alineación para imágenes GS v 0 y lo
    // pegaban a la izquierda.
    const lienzo = Math.max(tamano.lienzoDots ?? 0, recortado.info.width);
    const izquierda = Math.floor((lienzo - recortado.info.width) / 2);
    const { data, info } = await sharp(recortado.data)
      .extend({ left: izquierda, right: lienzo - recortado.info.width - izquierda, background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .greyscale()
      .threshold(160) // 1 bit: negro si es más oscuro que el umbral, blanco si no
      .raw()
      .toBuffer({ resolveWithObject: true });

    const anchoDots = info.width;
    const altoDots = info.height;
    const anchoBytes = Math.ceil(anchoDots / 8);
    const datos = Buffer.alloc(anchoBytes * altoDots);

    for (let y = 0; y < altoDots; y++) {
      for (let x = 0; x < anchoDots; x++) {
        const negro = data.readUInt8(y * anchoDots + x) < 128;
        if (negro) {
          const i = y * anchoBytes + (x >> 3);
          datos.writeUInt8(datos.readUInt8(i) | (0x80 >> (x & 7)), i);
        }
      }
    }

    return { anchoDots, altoDots, datosBase64: datos.toString("base64") };
  } catch {
    // Sin logo el recibo se sigue imprimiendo igual -- sin bloquear el
    // trabajo por una imagen que no se pudo bajar o decodificar.
    return null;
  }
}
