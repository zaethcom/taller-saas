import { describe, expect, it } from "vitest";
import { booleano, enLotes, leerCatalogo, normalizarEncabezado, numero } from "../lib/catalogo-importar";

describe("lectura de celdas", () => {
  it("normaliza encabezados sin tildes ni espacios", () => {
    expect(normalizarEncabezado(" Precio Venta ")).toBe("precio_venta");
    expect(normalizarEncabezado("Descripción")).toBe("descripcion");
    expect(normalizarEncabezado("tiempo-estimado-minutos")).toBe("tiempo_estimado_minutos");
  });

  it("lee números de Excel y texto en formato colombiano", () => {
    expect(numero(85000)).toBe(85000);
    expect(numero("85.000")).toBe(85000);
    expect(numero("$ 1.250.000")).toBe(1250000);
    expect(numero("12,5")).toBe(12.5);
    expect(numero("Cotizar")).toBeNull();
    expect(numero("")).toBeNull();
  });

  it("entiende SÍ/NO con o sin tilde", () => {
    expect(booleano("SÍ", false)).toBe(true);
    expect(booleano("no", true)).toBe(false);
    expect(booleano(null, true)).toBe(true);
  });
});

describe("leerCatalogo", () => {
  const repuesto = {
    codigo: "PAN-SAM-A15-INC",
    descripcion: "Pantalla Galaxy A15 Incell/LCD",
    categoria: "Pantallas",
    subcategoria: "Samsung",
    marca: "Samsung",
    modelo: "Galaxy A15",
    costo: 85000,
    precio_venta: 115000,
    en_venta: "NO",
    observacion: "Validar referencia",
  };

  it("arma repuestos, categorías y servicios", () => {
    const r = leerCatalogo({
      Repuestos: { filas: [repuesto] },
      Accesorios: {
        filas: [{ codigo: "ACC-CAB-AL", descripcion: "Cable Lightning", categoria: "Cables", subcategoria: "Lightning", marca: "Remax", precio_venta: 28000 }],
      },
      Servicios: { filas: [{ codigo: "SRV-PAN-GB", nombre: "Cambio de pantalla – Gama baja", precio: 45000, tiempo_estimado_minutos: 60 }] },
    });
    expect(r.repuestos).toHaveLength(2);
    expect(r.repuestos[0]).toMatchObject({ codigo: "PAN-SAM-A15-INC", precioVenta: 115000, costo: 85000, enVenta: false });
    // La subcategoría igual a la marca no se repite en la observación.
    expect(r.repuestos[0]?.observacion).toBe("Validar referencia");
    expect(r.repuestos[1]).toMatchObject({ enVenta: true, observacion: "Subcategoría: Lightning" });
    expect(r.categorias).toEqual(["Cables", "Pantallas"]);
    expect(r.servicios).toEqual([
      expect.objectContaining({ codigo: "SRV-PAN-GB", precio: 45000, tiempoEstimadoMinutos: 60, activo: true }),
    ]);
    expect(r.omitidas).toEqual([]);
  });

  it("omite filas sin precio o sin código y salta las vacías", () => {
    const r = leerCatalogo({
      Repuestos: {
        filas: [
          { ...repuesto, codigo: "PAN-SAM-ZFLIP6-OLED", precio_venta: null },
          { ...repuesto, codigo: null },
          {},
          repuesto,
        ],
      },
    });
    expect(r.repuestos.map((x) => x.codigo)).toEqual(["PAN-SAM-A15-INC"]);
    expect(r.omitidas).toEqual([
      { hoja: "Repuestos", fila: 2, motivo: "PAN-SAM-ZFLIP6-OLED: sin precio de venta" },
      { hoja: "Repuestos", fila: 3, motivo: "sin código" },
    ]);
  });

  it("un código repetido queda con la última fila y se avisa", () => {
    const r = leerCatalogo({
      Repuestos: { filas: [repuesto] },
      Accesorios: { filas: [{ ...repuesto, codigo: "pan-sam-a15-inc", precio_venta: 99000 }] },
    });
    expect(r.repuestos).toHaveLength(1);
    expect(r.repuestos[0]?.precioVenta).toBe(99000);
    expect(r.omitidas[0]?.motivo).toMatch(/código repetido/);
  });
});

describe("enLotes", () => {
  it("parte la lista sin perder elementos", () => {
    expect(enLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(enLotes([], 3)).toEqual([]);
  });
});
