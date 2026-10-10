import { describe, expect, it } from "vitest";
import {
  aplicarAjustes,
  comandosPplb,
  comandosZpl,
  normalizarAjustes,
} from "./ajustes-etiquetadora";
import { resolverImpresion } from "./resolver";

describe("normalizarAjustes", () => {
  it("recorta lo que se sale de rango y descarta lo que no es número", () => {
    expect(
      normalizarAjustes({
        oscuridad: 45,
        velocidad: "3",
        sensor: "raro",
        verticalMm: -40,
        corteMm: "x",
      }),
    ).toEqual({ oscuridad: 30, velocidad: 3, verticalMm: -15 });
  });

  it("vacío o basura no da ningún ajuste", () => {
    expect(normalizarAjustes(null)).toEqual({});
    expect(normalizarAjustes({ verticalMm: 0, oscuridad: "" })).toEqual({});
  });
});

describe("comandosZpl", () => {
  it("sin ajustes no manda nada", () => {
    expect(comandosZpl({})).toBe("");
  });

  it("traduce cada ajuste a su comando, en puntos de 8 por mm", () => {
    expect(
      comandosZpl({
        oscuridad: 20,
        velocidad: 3,
        sensor: "espacio",
        verticalMm: 1.5,
        horizontalMm: 2,
        corteMm: -1,
      }),
    ).toBe("~SD20^PR3,3,3^MNW^LT12^LS-16~TA-008");
  });

  it("con algún ajuste, deja los corrimientos en 0 para deshacer uno anterior", () => {
    expect(comandosZpl({ corteMm: 2 })).toBe("^LT0^LS0~TA016");
  });
});

describe("comandosPplb", () => {
  it("pasa la oscuridad a la escala 0-15 de Argox y no manda corrimientos negativos", () => {
    expect(
      comandosPplb({
        oscuridad: 21,
        velocidad: 2,
        verticalMm: -3,
        horizontalMm: 1,
      }),
    ).toBe("D11\r\nS2\r\nR8,0\r\n");
  });
});

describe("aplicarAjustes", () => {
  it("en ZPL los mete justo después de ^XA", () => {
    expect(
      aplicarAjustes("^XA^CI28^FDhola^FS^XZ", "zpl", { oscuridad: 5 }),
    ).toBe("^XA~SD05^LT0^LS0^CI28^FDhola^FS^XZ");
  });

  it("en PPLB van antes de N, también cuando la etiqueta es un Buffer", () => {
    const r = aplicarAjustes(Buffer.from("N\r\nP1\r\n"), "pplb", {
      velocidad: 3,
    });
    expect(Buffer.isBuffer(r)).toBe(true);
    expect(r.toString()).toBe("S3\r\nN\r\nP1\r\n");
  });

  it("sin ajustes deja la etiqueta igual", () => {
    expect(aplicarAjustes("^XA^XZ", "zpl", undefined)).toBe("^XA^XZ");
  });
});

describe("resolverImpresion con ajustes", () => {
  const articulo = {
    id: "1",
    tipo: "etiqueta_articulo" as const,
    carga: { codigo: "ART-1", tipo: "Patineta", marca: null, modelo: null },
  };

  it("los aplica a las etiquetas", () => {
    const { contenido } = resolverImpresion(articulo, "zpl", { velocidad: 2 });
    expect(contenido.toString()).toMatch(/^\^XA\^PR2,2,2\^LT0\^LS0\^CI28/);
  });

  it("no toca los tickets", () => {
    const sin = resolverImpresion(
      { id: "2", tipo: "abrir_cajon", carga: {} },
      "zpl",
    );
    const con = resolverImpresion(
      { id: "2", tipo: "abrir_cajon", carga: {} },
      "zpl",
      { oscuridad: 10 },
    );
    expect(
      Buffer.compare(Buffer.from(con.contenido), Buffer.from(sin.contenido)),
    ).toBe(0);
  });
});
