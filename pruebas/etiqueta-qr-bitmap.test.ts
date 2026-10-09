import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { generarEtiquetaQrRaster } from "../lib/etiqueta-bitmap";

function pixel(datos: Buffer, anchoDots: number, x: number, y: number): boolean {
  const i = y * Math.ceil(anchoDots / 8) + (x >> 3);
  return ((datos[i] ?? 0) & (0x80 >> (x & 7))) !== 0;
}

describe("etiqueta QR de la orden como bitmap", () => {
  it("el QR queda completo dentro de la etiqueta, del tamaño de sus módulos, con el código debajo", async () => {
    const codigo = "PS13";
    const r = await generarEtiquetaQrRaster(codigo);
    const datos = Buffer.from(r.datosBase64, "base64");
    expect([r.anchoDots, r.altoDots]).toEqual([240, 200]);

    const qr = QRCode.create(codigo, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const modulo = Math.floor(140 / n);
    const tam = modulo * n;
    const x0 = Math.round((240 - tam) / 2);
    const y0 = 10;

    // Cada módulo del QR, muestreado en su centro, coincide con lo dibujado.
    let distintos = 0;
    for (let fy = 0; fy < n; fy++) {
      for (let fx = 0; fx < n; fx++) {
        const esperado = qr.modules.get(fy, fx) === 1;
        const dibujado = pixel(datos, r.anchoDots, x0 + fx * modulo + (modulo >> 1), y0 + fy * modulo + (modulo >> 1));
        if (esperado !== dibujado) distintos++;
      }
    }
    expect(distintos).toBe(0);

    // A la derecha del QR, dentro del marco, no hay nada (antes salía corrido y cortado).
    for (let y = y0; y < y0 + tam; y++) {
      for (let x = x0 + tam + 2; x < 228; x++) expect(pixel(datos, r.anchoDots, x, y)).toBe(false);
    }

    // Debajo del QR está el código de entrada.
    let negrosTexto = 0;
    for (let y = y0 + tam + 4; y < 190; y++) for (let x = 20; x < 220; x++) if (pixel(datos, r.anchoDots, x, y)) negrosTexto++;
    expect(negrosTexto).toBeGreaterThan(50);
  });
});
