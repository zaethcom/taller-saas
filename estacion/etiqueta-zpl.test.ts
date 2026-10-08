import { describe, expect, it } from "vitest";
import { etiquetaArticuloZpl, etiquetaQrZpl, etiquetaRasterZpl, etiquetaRepuestoZpl } from "./etiqueta-zpl";

// 16x2 dots = 2 bytes por fila, 4 bytes en total.
const raster = { anchoDots: 16, altoDots: 2, datosBase64: Buffer.from([0xff, 0x00, 0x0f, 0xf0]).toString("base64") };

describe("etiquetaRasterZpl", () => {
  it("abre con ^XA en UTF-8 y cierra con ^XZ", () => {
    const zpl = etiquetaRasterZpl(raster, 1);
    expect(zpl.startsWith("^XA^CI28")).toBe(true);
    expect(zpl.endsWith("^XZ")).toBe(true);
  });

  it("declara ancho y largo de la etiqueta según la imagen", () => {
    const zpl = etiquetaRasterZpl(raster, 1);
    expect(zpl).toContain("^PW16");
    expect(zpl).toContain("^LL2");
  });

  it("embebe la imagen con ^GFA en hex, sin invertir (1 = negro)", () => {
    expect(etiquetaRasterZpl(raster, 1)).toContain("^FO0,0^GFA,4,4,2,FF000FF0^FS");
  });

  it("repite copias con ^PQ y cae a 1 si el número no sirve", () => {
    expect(etiquetaRasterZpl(raster, 3)).toContain("^PQ3");
    expect(etiquetaRasterZpl(raster, 0)).toContain("^PQ1");
  });

  it("la etiqueta de la orden es la imagen, una copia", () => {
    expect(etiquetaQrZpl({ etiquetaRaster: raster })).toBe(etiquetaRasterZpl(raster, 1));
  });
});

describe("etiquetaArticuloZpl", () => {
  const base = { codigo: "ART-000123", tipo: "patineta", marca: "Xiaomi", modelo: "Pro 2" };

  it("lleva código, marca/modelo y un Code128 con el código", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl).toContain("^FDART-000123^FS");
    expect(zpl).toContain("^FDXiaomi Pro 2^FS");
    expect(zpl).toMatch(/\^BCN,\d+,N,N,N\^FDART-000123\^FS/);
  });

  it("cae al tipo si no hay marca ni modelo", () => {
    expect(etiquetaArticuloZpl({ ...base, marca: null, modelo: null })).toContain("^FDpatineta^FS");
  });

  it("no deja pasar ^ ni ~ dentro de un texto", () => {
    expect(etiquetaArticuloZpl({ ...base, modelo: "A^B~C" })).toContain("^FDXiaomi A B C^FS");
  });
});

describe("etiquetaRepuestoZpl", () => {
  it("imprime tantas copias como unidades", () => {
    const zpl = etiquetaRepuestoZpl({
      nombreEmpresa: "Polaco Scooter",
      codigo: "REP-9",
      descripcion: "Llanta 10\"",
      cantidadCopias: 4,
    });
    expect(zpl).toContain("^PQ4");
    expect(zpl).toMatch(/\^BCN,\d+,N,N,N\^FDREP-9\^FS/);
  });
});
