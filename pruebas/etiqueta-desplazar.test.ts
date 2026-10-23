import { describe, expect, it } from "vitest";
import { desplazarRaster } from "../lib/etiquetas/desplazar";

/** Bitmap de 8x1 con un solo punto negro en la columna `x`. */
const punto = (x: number) => ({ anchoDots: 8, altoDots: 1, datosBase64: Buffer.from([0x80 >> x]).toString("base64") });
const bits = (r: { datosBase64: string }) => [...Buffer.from(r.datosBase64, "base64")];

describe("desplazarRaster()", () => {
  it("a la derecha agrega columnas blancas a la izquierda sin recortar el diseño", () => {
    const r = desplazarRaster(punto(0), 3);
    expect(r.anchoDots).toBe(11);
    expect(bits(r)).toEqual([0x10, 0x00]); // el punto pasó de la columna 0 a la 3
  });

  it("a la izquierda quita columnas de la izquierda", () => {
    const r = desplazarRaster(punto(5), -3);
    expect(r.anchoDots).toBe(8);
    expect(bits(r)).toEqual([0x80 >> 2]);
  });

  it("sin corrimiento devuelve la misma imagen", () => {
    const r = punto(2);
    expect(desplazarRaster(r, 0)).toBe(r);
  });
});
