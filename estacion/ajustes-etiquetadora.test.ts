import { describe, expect, it } from "vitest";
import { aplicarAjustes, comandosPplb, comandosZpl, normalizarAjustes } from "./ajustes-etiquetadora";
import { resolverImpresion } from "./resolver";

describe("normalizarAjustes", () => {
  it("vacío o basura no manda nada", () => {
    expect(normalizarAjustes(null)).toEqual({});
    expect(normalizarAjustes("x")).toEqual({});
    expect(normalizarAjustes({ oscuridad: "abc", sensor: "otro", metodo: 3, girar: "si" })).toEqual({});
  });

  it("recorta lo que se sale de rango y acepta coma decimal", () => {
    expect(
      normalizarAjustes({ oscuridad: 45, velocidad: 1, avanceMm: "20", verticalMm: "-2,5", horizontalMm: 0 }),
    ).toEqual({ oscuridad: 30, velocidad: 2, avanceMm: 15, verticalMm: -2.5 });
  });

  it("guarda sensor, método y giro válidos", () => {
    expect(normalizarAjustes({ sensor: "marca", metodo: "directa", girar: true })).toEqual({
      sensor: "marca",
      metodo: "directa",
      girar: true,
    });
  });
});

describe("comandosZpl", () => {
  it("sin ajustes no manda nada", () => {
    expect(comandosZpl({})).toBe("");
  });

  it("oscuridad, velocidad y avance de 5 mm", () => {
    expect(comandosZpl({ oscuridad: 8, velocidad: 2, avanceMm: 5 })).toBe(
      "~SD08^PR2,2,2~TA040^LT0^LS0^PON",
    );
  });

  it("avance negativo, sensor, método, corrimientos y giro", () => {
    expect(
      comandosZpl({
        avanceMm: -2,
        sensor: "espacio",
        metodo: "directa",
        verticalMm: 1.5,
        horizontalMm: 2,
        girar: true,
      }),
    ).toBe("^MNW^MTD~TA-016^LT12^LS-16^POI");
  });

  it("avance de 10 mm son 80 puntos", () => {
    expect(comandosZpl({ avanceMm: 10 })).toContain("~TA080");
  });
});

describe("comandosPplb", () => {
  it("Argox: oscuridad a la mitad, punto de inicio sin negativos y giro", () => {
    expect(comandosPplb({ oscuridad: 20, verticalMm: -3, horizontalMm: 2, girar: true })).toBe(
      "D10\r\nR16,0\r\nZB\r\n",
    );
  });

  it("ignora lo que Argox no entiende", () => {
    expect(comandosPplb({ velocidad: 3, avanceMm: 5 })).toBe("ZT\r\n");
    expect(comandosPplb({})).toBe("");
  });
});

describe("aplicarAjustes", () => {
  it("ZPL: los mete después de ^XA", () => {
    const r = aplicarAjustes(Buffer.from("^XA^CI28^FO0,0^FDx^FS^XZ"), "zpl", { oscuridad: 10 });
    expect(r.toString()).toBe("^XA~SD10~TA000^LT0^LS0^PON^CI28^FO0,0^FDx^FS^XZ");
  });

  it("PPLB: van antes de N", () => {
    const r = aplicarAjustes("N\r\nP1\r\n", "pplb", { oscuridad: 30 });
    expect(r).toBe("D15\r\nZT\r\nN\r\nP1\r\n");
  });

  it("la POS de tickets no se toca", () => {
    const b = Buffer.from([1, 2, 3]);
    expect(aplicarAjustes(b, "escpos", { oscuridad: 30 })).toBe(b);
  });

  it("sin ajustes devuelve lo mismo", () => {
    expect(aplicarAjustes("N\r\n", "pplb", undefined)).toBe("N\r\n");
  });
});

describe("resolverImpresion con ajustes", () => {
  const raster = { anchoDots: 16, altoDots: 2, datosBase64: Buffer.from([0xff, 0x00, 0x0f, 0xf0]).toString("base64") };
  const qr = { id: "1", tipo: "etiqueta_qr" as const, carga: { etiquetaRaster: raster } };

  it("la etiqueta Zebra lleva los ajustes", () => {
    const r = resolverImpresion(qr, "zpl", { avanceMm: 5 });
    expect(r.destino).toBe("etiquetas");
    expect(r.contenido.toString()).toContain("~TA040");
  });

  it("los recibos no llevan ajustes de la etiquetadora", () => {
    const r = resolverImpresion({ id: "2", tipo: "abrir_cajon", carga: {} }, "zpl", { oscuridad: 30 });
    expect(r.contenido.toString()).not.toContain("~SD");
  });
});
