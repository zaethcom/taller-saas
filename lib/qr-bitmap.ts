/**
 * El QR del comprobante de recepción (ticket de 80mm), como bitmap --
 * igual patrón que lib/logo-bitmap.ts y lib/etiqueta-bitmap.ts.
 *
 * Se cambió de comando nativo (estacion/escpos.ts::qr(), GS ( k) a esto
 * después de confirmar en hardware real (impresora Perto/PERTO Printer
 * TEC, ticket de recepción) que ese comando no funciona en ese modelo:
 * la impresora no lo interpreta como QR y termina imprimiendo los
 * bytes imprimibles de la secuencia como texto plano literal
 * ("1A21C1E1P0https://...1Q0" en el papel). El logo ya se resolvía así
 * (bitmap vía GS v 0) precisamente por este mismo tipo de problema de
 * compatibilidad -- el QR sigue el mismo camino en vez de depender de
 * soporte nativo que no se puede garantizar por impresora.
 */
import sharp from "sharp";
import QRCode from "qrcode";
import type { LogoRaster } from "./logo-bitmap";

export async function generarQrRaster(contenido: string, anchoDots = 300): Promise<LogoRaster> {
  const svg = await QRCode.toString(contenido, {
    type: "svg",
    margin: 1,
    width: anchoDots,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: "#ffffff" })
    .greyscale()
    .threshold(160)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const anchoBytes = Math.ceil(info.width / 8);
  const datos = Buffer.alloc(anchoBytes * info.height);

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const negro = data.readUInt8(y * info.width + x) < 128;
      if (negro) {
        const i = y * anchoBytes + (x >> 3);
        datos.writeUInt8(datos.readUInt8(i) | (0x80 >> (x & 7)), i);
      }
    }
  }

  return { anchoDots: info.width, altoDots: info.height, datosBase64: datos.toString("base64") };
}
