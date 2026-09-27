import { describe, expect, it } from "vitest";
import { etiquetaArticuloPplb, etiquetaQrPplb, etiquetaRepuestoPplb } from "./etiqueta";

describe("etiquetaQrPplb", () => {
  // Raster mínimo válido (1x8 dots, un solo byte) -- alcanza para probar
  // que el comando GW se arma bien, sin necesitar una imagen real.
  const raster = { anchoDots: 8, altoDots: 1, datosBase64: Buffer.from([0xff]).toString("base64") };
  const base = { etiquetaRaster: raster };

  it("empieza con N (limpiar buffer) y termina con P1 (imprimir una copia)", () => {
    const pplb = etiquetaQrPplb(base);
    expect(pplb.subarray(0, 3).toString("ascii")).toBe("N\r\n");
    expect(pplb.subarray(-6).toString("ascii")).toBe("\r\nP1\r\n");
  });

  it("embebe el bitmap con el comando de gráfico GW (ancho en bytes, alto en dots, datos crudos)", () => {
    const pplb = etiquetaQrPplb(base);
    const encabezado = `GW0,0,${Math.ceil(raster.anchoDots / 8)},${raster.altoDots},`;
    const idx = pplb.indexOf(Buffer.from(encabezado, "ascii"));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(pplb[idx + encabezado.length]).toBe(0xff);
  });
});

describe("etiquetaArticuloPplb", () => {
  const base = {
    codigo: "ART-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
  };

  it("empieza con N y termina con P1", () => {
    const pplb = etiquetaArticuloPplb(base);
    expect(pplb.startsWith("N\r\n")).toBe(true);
    expect(pplb.trimEnd().endsWith("P1")).toBe(true);
  });

  it("muestra el código en su propio campo de texto grande", () => {
    const pplb = etiquetaArticuloPplb(base);
    expect(pplb).toContain(`"${base.codigo}"`);
  });

  it("junta marca y modelo cuando ambos existen", () => {
    const pplb = etiquetaArticuloPplb(base);
    expect(pplb).toContain('"Xiaomi Pro 2"');
  });

  it("cae al tipo si no hay marca ni modelo", () => {
    const pplb = etiquetaArticuloPplb({ ...base, marca: null, modelo: null });
    expect(pplb).toContain('"patineta"');
  });

  it("dibuja un código de barras 1D con el código del artículo, rotado 180° (confirmado en hardware real)", () => {
    const pplb = etiquetaArticuloPplb(base);
    expect(pplb).toMatch(/^B\d+,\d+,2,2,3,7,60,N,"ART-000123"$/m);
  });
});

describe("etiquetaRepuestoPplb", () => {
  const base = {
    nombreEmpresa: "Polaco Scooter",
    codigo: "F-1023",
    descripcion: "Pastilla de freno delantera",
    cantidadCopias: 3,
  };

  it("empieza con N y termina con P<cantidadCopias>", () => {
    const pplb = etiquetaRepuestoPplb(base);
    expect(pplb.startsWith("N\r\n")).toBe(true);
    expect(pplb.trimEnd().endsWith("P3")).toBe(true);
  });

  it("dibuja un código de barras 1D con el código del repuesto, rotado 180° (confirmado en hardware real)", () => {
    const pplb = etiquetaRepuestoPplb(base);
    expect(pplb).toMatch(/^B\d+,\d+,2,2,3,7,80,N,"F-1023"$/m);
  });

  it("muestra el nombre de la empresa y la descripción del repuesto", () => {
    const pplb = etiquetaRepuestoPplb(base);
    expect(pplb).toContain(`"${base.nombreEmpresa}"`);
    expect(pplb).toContain(`"${base.descripcion}"`);
  });

  it("pide una copia por cada unidad recibida (P<cantidadCopias>, no P1 fijo)", () => {
    const unaCopia = etiquetaRepuestoPplb({ ...base, cantidadCopias: 1 });
    const tresCopias = etiquetaRepuestoPplb({ ...base, cantidadCopias: 3 });
    expect(unaCopia.trimEnd().endsWith("P1")).toBe(true);
    expect(tresCopias.trimEnd().endsWith("P3")).toBe(true);
  });
});
