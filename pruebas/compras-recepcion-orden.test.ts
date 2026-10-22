import { describe, expect, it } from "vitest";
import {
  esEventoRepuestoRecibido,
  normalizarRecepcion,
  notaRepuestoRecibido,
  resumirContabilidad,
  siguePorRepuesto,
} from "../lib/compras/recepcion-orden";

describe("normalizarRecepcion", () => {
  it("pide producto, cantidad y costo", () => {
    expect(normalizarRecepcion({ producto: "  Pantalla   A10 ", cantidad: "2", costo: "85000" })).toEqual({
      ok: true,
      datos: { producto: "Pantalla A10", cantidad: 2, costo: 85000 },
    });
    expect(normalizarRecepcion({ producto: "", cantidad: 1, costo: 1 }).ok).toBe(false);
    expect(normalizarRecepcion({ producto: "x", cantidad: 0, costo: 1 }).ok).toBe(false);
    expect(normalizarRecepcion({ producto: "x", cantidad: 1, costo: "" }).ok).toBe(false);
    expect(normalizarRecepcion({ producto: "x", cantidad: 1, costo: -5 }).ok).toBe(false);
    expect(normalizarRecepcion(null).ok).toBe(false);
  });

  it("acepta costo cero (garantía, regalo)", () => {
    expect(normalizarRecepcion({ producto: "x", cantidad: 1, costo: 0 }).ok).toBe(true);
  });
});

describe("historial", () => {
  it("la nota no lleva el costo y se reconoce como evento de repuesto", () => {
    const nota = notaRepuestoRecibido({ producto: "Batería", cantidad: 2 });
    expect(nota).toBe("Llegó el repuesto: Batería (x2)");
    expect(esEventoRepuestoRecibido({ de_estado: "en_reparacion", a_estado: "en_reparacion", nota })).toBe(true);
    expect(esEventoRepuestoRecibido({ de_estado: "esperando_repuesto", a_estado: "en_reparacion", nota })).toBe(false);
  });
});

describe("siguePorRepuesto", () => {
  it("solo cuando esperaba repuesto y ya no falta nada", () => {
    expect(siguePorRepuesto("esperando_repuesto", 0)).toBe(true);
    expect(siguePorRepuesto("esperando_repuesto", 1)).toBe(false);
    expect(siguePorRepuesto("en_reparacion", 0)).toBe(false);
  });
});

describe("resumirContabilidad", () => {
  it("gastado = compras + inventario a costo; utilidad = cobrado − gastado", () => {
    const r = resumirContabilidad({
      cobrado: 200000,
      pagado: 50000,
      compras: [{ producto: "Pantalla", cantidad: 1, costo: 90000 }],
      inventario: [
        { descripcion: "Adhesivo", cantidad: 2, costoUnit: 5000 },
        { descripcion: "Tornillo", cantidad: 1, costoUnit: null },
      ],
    });
    expect(r.costoCompras).toBe(90000);
    expect(r.costoInventario).toBe(10000);
    expect(r.gastado).toBe(100000);
    expect(r.utilidad).toBe(100000);
    expect(r.margen).toBe(50);
    expect(r.sinCosto).toBe(1);
  });

  it("sin cobro no hay margen", () => {
    expect(resumirContabilidad({ cobrado: 0, pagado: 0, compras: [], inventario: [] }).margen).toBeNull();
  });
});
