import { describe, expect, it } from "vitest";
import { clasificarRepuestos, normalizarRepuestos, notaRepuestosRecepcion } from "../lib/repuestos-recepcion";

describe("normalizarRepuestos", () => {
  it("descarta líneas sin descripción o sin cantidad", () => {
    expect(
      normalizarRepuestos([
        { descripcion: "  Pantalla A10 ", cantidad: 1 },
        { descripcion: "", cantidad: 2 },
        { descripcion: "Batería", cantidad: 0 },
        null,
        { repuestoId: "r1", descripcion: "Pin de carga", cantidad: "2" },
      ]),
    ).toEqual([
      { repuestoId: undefined, descripcion: "Pantalla A10", cantidad: 1 },
      { repuestoId: "r1", descripcion: "Pin de carga", cantidad: 2 },
    ]);
  });

  it("no acepta algo que no sea una lista", () => {
    expect(normalizarRepuestos(undefined)).toEqual([]);
    expect(normalizarRepuestos("pantalla")).toEqual([]);
  });
});

describe("clasificarRepuestos", () => {
  it("lo que no está en el catálogo siempre se compra", () => {
    const r = clasificarRepuestos([{ descripcion: "Flex de botones", cantidad: 1 }], new Map());
    expect(r.faltantes).toEqual([{ descripcion: "Flex de botones", cantidad: 1 }]);
    expect(r.disponibles).toEqual([]);
  });

  it("sin existencia en la sede pasa completo a Compras", () => {
    const r = clasificarRepuestos([{ repuestoId: "r1", descripcion: "Pantalla", cantidad: 1 }], new Map([["r1", 0]]));
    expect(r.faltantes).toEqual([{ repuestoId: "r1", descripcion: "Pantalla", cantidad: 1 }]);
  });

  it("si alcanza, no va a Compras", () => {
    const r = clasificarRepuestos([{ repuestoId: "r1", descripcion: "Pantalla", cantidad: 1 }], new Map([["r1", 3]]));
    expect(r.faltantes).toEqual([]);
    expect(r.disponibles).toEqual([{ repuestoId: "r1", descripcion: "Pantalla", cantidad: 1 }]);
  });

  it("si alcanza solo una parte, compra la diferencia", () => {
    const r = clasificarRepuestos([{ repuestoId: "r1", descripcion: "Tornillo", cantidad: 5 }], new Map([["r1", 2]]));
    expect(r.disponibles).toEqual([{ repuestoId: "r1", descripcion: "Tornillo", cantidad: 2 }]);
    expect(r.faltantes).toEqual([{ repuestoId: "r1", descripcion: "Tornillo", cantidad: 3 }]);
  });

  it("el mismo repuesto en dos líneas no cuenta la existencia dos veces", () => {
    const r = clasificarRepuestos(
      [
        { repuestoId: "r1", descripcion: "Batería", cantidad: 1 },
        { repuestoId: "r1", descripcion: "Batería", cantidad: 1 },
      ],
      new Map([["r1", 1]]),
    );
    expect(r.disponibles).toHaveLength(1);
    expect(r.faltantes).toEqual([{ repuestoId: "r1", descripcion: "Batería", cantidad: 1 }]);
  });
});

describe("notaRepuestosRecepcion", () => {
  it("resume lo que va a Compras y lo que hay", () => {
    expect(
      notaRepuestosRecepcion({
        faltantes: [{ descripcion: "Pantalla", cantidad: 1 }],
        disponibles: [{ descripcion: "Tornillo", cantidad: 2 }],
      }),
    ).toBe("Repuestos identificados al recibir. Sin existencia, pasa a Compras: Pantalla. Disponible en la sede: Tornillo ×2.");
  });

  it("sin repuestos no deja nota", () => {
    expect(notaRepuestosRecepcion({ faltantes: [], disponibles: [] })).toBeNull();
  });
});
