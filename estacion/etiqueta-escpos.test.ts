import { describe, expect, it } from "vitest";
import { resolverImpresion } from "./resolver";
import { ajustarRaster } from "./etiqueta-escpos";

const raster = { anchoDots: 16, altoDots: 2, datosBase64: Buffer.from([0xff, 0x00, 0x0f, 0xf0]).toString("base64") };

describe("etiquetas en la POS (escpos)", () => {
  it("la etiqueta de la orden va a tickets como imagen GS v 0, sin comandos PPLB", () => {
    const r = resolverImpresion({ id: "1", tipo: "etiqueta_qr", carga: { etiquetaRaster: raster } }, "escpos");
    expect(r.destino).toBe("tickets");
    const b = Buffer.isBuffer(r.contenido) ? r.contenido : Buffer.from(r.contenido);
    const i = b.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0x00, 2, 0, 2, 0]));
    expect(i).toBeGreaterThan(-1);
    expect([...b.subarray(i + 8, i + 12)]).toEqual([0xff, 0x00, 0x0f, 0xf0]);
    expect(b.includes(Buffer.from("GW"))).toBe(false);
  });

  it("repite la imagen una vez por copia de repuesto", () => {
    const r = resolverImpresion(
      {
        id: "2",
        tipo: "etiqueta_repuesto",
        carga: { nombreEmpresa: "X", codigo: "R1", descripcion: "Pantalla", cantidadCopias: 3, etiquetaRaster: raster },
      },
      "escpos",
    );
    const b = r.contenido as Buffer;
    let n = 0;
    for (let i = b.indexOf(Buffer.from([0x1d, 0x76, 0x30])); i !== -1; i = b.indexOf(Buffer.from([0x1d, 0x76, 0x30]), i + 1)) n++;
    expect(n).toBe(3);
  });

  it("sin plantilla, el artículo sale en texto con su código", () => {
    const r = resolverImpresion(
      { id: "3", tipo: "etiqueta_articulo", carga: { codigo: "ART-000123", tipo: "Celular", marca: "Moto", modelo: "G8" } },
      "escpos",
    );
    expect(r.destino).toBe("tickets");
    expect((r.contenido as Buffer).toString("latin1")).toContain("ART-000123");
  });

  it("los recibos no cambian", () => {
    const pplb = resolverImpresion({ id: "4", tipo: "abrir_cajon", carga: {} }, "pplb");
    const escpos = resolverImpresion({ id: "4", tipo: "abrir_cajon", carga: {} }, "escpos");
    expect(escpos).toEqual(pplb);
  });
});

describe("etiqueta en la POS de 58 mm", () => {
  const ancha = { anchoDots: 440, altoDots: 480, datosBase64: Buffer.alloc(55 * 480, 0xff).toString("base64") };

  it("en 80 mm la etiqueta de 55 mm sale tal cual", () => {
    expect(ajustarRaster(ancha, 576)).toBe(ancha);
  });

  it("en 58 mm se achica a 384 puntos sin deformarse", () => {
    const r = resolverImpresion({ id: "5", tipo: "etiqueta_qr", carga: { etiquetaRaster: ancha, anchoPapelMm: 58 } }, "escpos");
    const b = r.contenido as Buffer;
    const i = b.indexOf(Buffer.from([0x1d, 0x76, 0x30, 0x00]));
    expect(b[i + 4]).toBe(48); // 384 puntos = 48 bytes
    expect(b[i + 6] | (b[i + 7] << 8)).toBe(419); // 480 * 384 / 440
    expect(b[i + 8]).toBe(0xff);
  });
});
