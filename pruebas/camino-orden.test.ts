import { describe, expect, it } from "vitest";
import { CAMINO, pasoActual, siguientePaso } from "../lib/camino-orden";
import { TRANSICIONES, puedeTransicionar, type Estado } from "../lib/estados";

const TODOS = Object.keys(TRANSICIONES) as Estado[];

describe("el camino de la orden", () => {
  it("cada estado cae en exactamente un paso", () => {
    for (const estado of TODOS) {
      expect(CAMINO.filter((p) => p.estados.includes(estado))).toHaveLength(1);
    }
  });

  it("los pasos van en orden", () => {
    expect(pasoActual("recibida")).toBe(0);
    expect(pasoActual("en_diagnostico")).toBe(1);
    expect(pasoActual("rechazada")).toBe(2);
    expect(pasoActual("esperando_repuesto")).toBe(3);
    expect(pasoActual("listo_entrega")).toBe(4);
    expect(pasoActual("entregada")).toBe(5);
  });
});

describe("siguientePaso", () => {
  it("todo botón que cambia el estado es una transición válida", () => {
    for (const estado of TODOS) {
      for (const accion of siguientePaso(estado).acciones) {
        if (accion.tipo === "estado") expect(puedeTransicionar(estado, accion.a)).toBe(true);
      }
    }
  });

  it("recibida lleva directo a diagnosticar y cotizar", () => {
    expect(siguientePaso("recibida").acciones[0]).toEqual({
      tipo: "ir",
      destino: "diagnostico",
      texto: "Diagnosticar y cotizar",
    });
  });

  it("esperando aprobación deja registrar lo que dijo el cliente", () => {
    const tipos = siguientePaso("esperando_aprobacion").acciones.map((a) => a.tipo);
    expect(tipos).toEqual(["aprobar", "estado"]);
  });

  it("una orden entregada ya no tiene siguiente paso", () => {
    expect(siguientePaso("entregada").acciones).toEqual([]);
  });
});
