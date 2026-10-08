import { describe, expect, it } from "vitest";
import { anchosCode128, modulosCode128, PATRONES_CODE128 } from "../lib/etiquetas/code128";
import { disenarEtiqueta, mmADots } from "../lib/etiquetas/diseno";
import { DATOS_EJEMPLO, MODELOS, filaAPlantilla, validarPlantilla, type DisenoEtiqueta } from "../lib/etiquetas/plantilla";
import { rasterEtiqueta } from "../lib/etiquetas/renderizar";

describe("Code 128", () => {
  it("cada patrón suma 11 módulos y el de parada 13", () => {
    expect(PATRONES_CODE128).toHaveLength(107);
    PATRONES_CODE128.forEach((p, i) => {
      const suma = [...p].map(Number).reduce((a, b) => a + b, 0);
      expect(suma).toBe(i === 106 ? 13 : 11);
    });
  });

  it("arranca con el inicio B, termina con la parada y cuadra con modulosCode128", () => {
    const anchos = anchosCode128("ART-000123");
    expect(anchos.slice(0, 6).join("")).toBe("211214");
    expect(anchos.slice(-7).join("")).toBe("2331112");
    expect(anchos.reduce((a, b) => a + b, 0)).toBe(modulosCode128("ART-000123"));
  });

  it("calcula la suma de control del juego B", () => {
    // "PJJ123C" es el ejemplo clásico: control = 55 -> patrón "311321".
    const anchos = anchosCode128("PJJ123C");
    expect(anchos.slice(-13, -7).join("")).toBe("311321");
  });
});

describe("validarPlantilla", () => {
  const base = { nombre: "Rollo 50x30", uso: "orden", anchoMm: 50, altoMm: 30, dpi: 203, codigo: "qr", campos: ["texto_codigo"] };

  it("acepta una plantilla válida y redondea a décimas de mm", () => {
    const r = validarPlantilla({ ...base, anchoMm: 50.04 });
    expect(r.ok && r.valor.anchoMm).toBe(50);
  });

  it("rechaza medidas fuera del rango del cabezal", () => {
    expect(validarPlantilla({ ...base, anchoMm: 200 }).ok).toBe(false);
    expect(validarPlantilla({ ...base, altoMm: 5 }).ok).toBe(false);
  });

  it("rechaza uso, código o campos desconocidos y nombre vacío", () => {
    expect(validarPlantilla({ ...base, uso: "factura" }).ok).toBe(false);
    expect(validarPlantilla({ ...base, codigo: "datamatrix" }).ok).toBe(false);
    expect(validarPlantilla({ ...base, campos: ["precio"] }).ok).toBe(false);
    expect(validarPlantilla({ ...base, nombre: "  " }).ok).toBe(false);
  });

  it("solo acepta imagen de fondo por https", () => {
    expect(validarPlantilla({ ...base, fondoUrl: "http://x/y.png" }).ok).toBe(false);
    expect(validarPlantilla({ ...base, fondoUrl: "https://x/y.png" }).ok).toBe(true);
  });

  it("todos los modelos de fábrica son válidos", () => {
    for (const m of MODELOS) {
      expect(validarPlantilla({ nombre: m.nombre, uso: m.uso, ...m.diseno }).ok).toBe(true);
    }
  });

  it("filaAPlantilla convierte numeric (string) a número", () => {
    const p = filaAPlantilla({
      id: "1", uso: "repuesto", nombre: "x", ancho_mm: "50.0", alto_mm: "25.0", dpi: 203,
      codigo: "barras", campos: null, fondo_url: null, girar: false, activa: true,
    });
    expect(p.anchoMm).toBe(50);
    expect(p.campos).toEqual([]);
  });
});

describe("disenarEtiqueta", () => {
  const diseno = (d: Partial<DisenoEtiqueta>): DisenoEtiqueta => ({
    anchoMm: 50, altoMm: 30, dpi: 203, codigo: "qr", campos: ["texto_codigo"], fondoUrl: null, girar: false, ...d,
  });

  it("mide en dots según la resolución", () => {
    expect(mmADots(30, 203)).toBe(240);
    const svg = disenarEtiqueta(diseno({ dpi: 300 }), DATOS_EJEMPLO.orden);
    expect(svg.anchoDots).toBe(mmADots(50, 300));
  });

  it("solo dibuja los textos pedidos", () => {
    const sin = disenarEtiqueta(diseno({ campos: [] }), DATOS_EJEMPLO.orden).svg;
    expect(sin).not.toContain("OR000123");
    const con = disenarEtiqueta(diseno({ campos: ["texto_codigo", "empresa"] }), DATOS_EJEMPLO.orden).svg;
    expect(con).toContain("OR000123");
    expect(con).toContain("Mi Taller");
  });

  it("escapa los textos para el SVG", () => {
    const svg = disenarEtiqueta(diseno({ campos: ["empresa"] }), { codigo: "X1", empresa: "A&B <S>" }).svg;
    expect(svg).toContain("A&amp;B &lt;S&gt;");
  });

  it("avisa cuando el código de barras no cabe a lo ancho", () => {
    const r = disenarEtiqueta(diseno({ anchoMm: 15, codigo: "barras" }), { codigo: "ARTICULO-MUY-LARGO-000123" });
    expect(r.avisos.join(" ")).toMatch(/no cabe/);
  });

  it("no avisa nada con los modelos de fábrica", () => {
    for (const m of MODELOS) {
      expect(disenarEtiqueta({ ...m.diseno, fondoUrl: null, girar: false }, DATOS_EJEMPLO[m.uso]).avisos).toEqual([]);
    }
  });
});

describe("rasterEtiqueta", () => {
  it("empaca 1 bit por dot, a la medida del sticker", async () => {
    const r = await rasterEtiqueta(
      { anchoMm: 30, altoMm: 25, dpi: 203, codigo: "qr", campos: ["texto_codigo", "marco"], fondoUrl: null, girar: false },
      DATOS_EJEMPLO.orden,
    );
    expect(r.anchoDots).toBe(240);
    expect(r.altoDots).toBe(200);
    expect(Buffer.from(r.datosBase64, "base64").length).toBe((240 / 8) * 200);
  });

  it("girar 180° invierte el bitmap", async () => {
    const d = { anchoMm: 30, altoMm: 25, dpi: 203, codigo: "barras", campos: ["texto_codigo"], fondoUrl: null } as const;
    const derecho = Buffer.from((await rasterEtiqueta({ ...d, campos: [...d.campos], girar: false }, DATOS_EJEMPLO.articulo)).datosBase64, "base64");
    const girado = Buffer.from((await rasterEtiqueta({ ...d, campos: [...d.campos], girar: true }, DATOS_EJEMPLO.articulo)).datosBase64, "base64");
    expect(girado.equals(derecho)).toBe(false);
    // La primera fila del girado es la última del derecho, al revés.
    const fila = (b: Buffer, y: number) => b.subarray(y * 30, y * 30 + 30);
    const bits = (b: Buffer) => [...b].map((x) => x.toString(2).padStart(8, "0")).join("");
    expect(bits(fila(girado, 0))).toBe([...bits(fila(derecho, 199))].reverse().join(""));
  });
});
