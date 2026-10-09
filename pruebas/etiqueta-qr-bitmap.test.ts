import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { generarEtiquetaQrRaster } from "../lib/etiqueta-bitmap";

function pixel(datos: Buffer, anchoDots: number, x: number, y: number): boolean {
  const i = y * Math.ceil(anchoDots / 8) + (x >> 3);
  return ((datos[i] ?? 0) & (0x80 >> (x & 7))) !== 0;
}

/**
 * Busca el QR completo dentro del bitmap, sin suponer dónde ni de qué
 * tamaño lo dibuja el diseño: cada módulo, muestreado en su centro, tiene
 * que coincidir con el QR que se esperaba. Así la prueba no depende de la
 * disposición de la etiqueta, solo de que el QR quede entero y legible.
 */
function encontrarQr(datos: Buffer, ancho: number, alto: number, codigo: string) {
  const qr = QRCode.create(codigo, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  for (let m = 2; m <= 10; m++) {
    for (let y0 = 0; y0 + n * m <= alto; y0++) {
      for (let x0 = 0; x0 + n * m <= ancho; x0++) {
        let ok = true;
        for (let fy = 0; fy < n && ok; fy++) {
          for (let fx = 0; fx < n && ok; fx++) {
            const esperado = qr.modules.get(fy, fx) === 1;
            if (pixel(datos, ancho, x0 + fx * m + (m >> 1), y0 + fy * m + (m >> 1)) !== esperado) ok = false;
          }
        }
        if (ok) return { x0, y0, modulo: m, tam: n * m };
      }
    }
  }
  return null;
}

describe("etiqueta QR de la orden como bitmap", () => {
  it("el QR queda completo dentro de la etiqueta, módulo por módulo", async () => {
    const codigo = "PS000013";
    const r = await generarEtiquetaQrRaster(codigo);
    const datos = Buffer.from(r.datosBase64, "base64");

    const qr = encontrarQr(datos, r.anchoDots, r.altoDots, codigo);
    expect(qr).not.toBeNull();
    // Un módulo de al menos 3 dots: a 203 dpi, más chico no lo lee un lector de mano.
    expect(qr!.modulo).toBeGreaterThanOrEqual(3);
  });
});
