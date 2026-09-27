/**
 * Renderiza la etiqueta de una orden (QR + código de entrada, con un
 * marco simple) como una sola imagen -- en vez de mandarle a la
 * impresora comandos de texto/QR nativos sueltos (que se probó que se
 * amontonan si algo altera la calibración de la impresora entre
 * trabajos, y dependen de qué tan bien la impresora dibuje texto/QR
 * por su cuenta).
 *
 * Mismo patrón que ya usa lib/logo-bitmap.ts: se compone en el
 * servidor con `sharp` (nunca en estacion/, que corre en Android/
 * Termux) y se manda como bitmap ya empacado a 1 bit -- estacion/
 * solo lo embebe en el comando PPLB `GW`, sin decodificar nada.
 *
 * Inspirado en com.smartfoodlabel.app.printer.engine.DulganiLabelRenderer
 * (mismo principio: la app dibuja el diseño completo como imagen, la
 * impresora solo reproduce píxeles) -- acá con SVG + sharp en vez de
 * android.graphics.Canvas, porque esto corre en Node, no en Android.
 *
 * Tamaño asumido: etiqueta de 30x25mm a 8 dots/mm (203dpi), igual que
 * el resto de estacion/etiqueta.ts -- sin confirmar con una ficha
 * técnica real, ver ese archivo.
 */
import sharp from "sharp";
import QRCode from "qrcode";
import type { LogoRaster } from "./logo-bitmap";

const ANCHO_DOTS = 240;
const ALTO_DOTS = 200;

export async function generarEtiquetaQrRaster(codigoEntrada: string): Promise<LogoRaster> {
  const qrSvg = await QRCode.toString(codigoEntrada, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#0000" },
  });
  // El QR de QRCode.toString ya trae su propio viewBox cuadrado -- se
  // reescala con width/height al insertarlo, sin tocar su contenido.
  const qrTam = 140;
  const qrX = (ANCHO_DOTS - qrTam) / 2;
  const qrY = 10;

  const svg = `
    <svg width="${ANCHO_DOTS}" height="${ALTO_DOTS}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${ANCHO_DOTS}" height="${ALTO_DOTS}" fill="white" />
      <rect x="4" y="4" width="${ANCHO_DOTS - 8}" height="${ALTO_DOTS - 8}"
            fill="none" stroke="black" stroke-width="4" rx="10" />
      <g transform="translate(${qrX}, ${qrY})">${qrSvg}</g>
      <text x="${ANCHO_DOTS / 2}" y="${qrY + qrTam + 32}" text-anchor="middle"
            font-family="sans-serif" font-weight="bold" font-size="26">${escaparXml(codigoEntrada)}</text>
    </svg>
  `;

  const { data, info } = await sharp(Buffer.from(svg))
    .resize(ANCHO_DOTS, ALTO_DOTS)
    .flatten({ background: "#ffffff" })
    .greyscale()
    .threshold(160)
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
}

function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
