import { describe, expect, it } from "vitest";
import { disponible, planearReserva } from "../lib/reservas";

const pantalla = { repuestoId: "p", descripcion: "Pantalla A10", cantidad: 1 };

describe("planearReserva", () => {
  it("aparta lo que hay en la sede", () => {
    expect(planearReserva([pantalla], new Map([["p", 2]]), new Map())).toEqual({ reservar: [pantalla], faltan: [] });
  });

  it("lo apartado para otra orden no está disponible", () => {
    expect(planearReserva([pantalla], new Map([["p", 1]]), new Map([["p", 1]]))).toEqual({
      reservar: [],
      faltan: [pantalla],
    });
  });

  it("si alcanza una parte, aparta esa y pide el resto", () => {
    const r = planearReserva([{ ...pantalla, cantidad: 3 }], new Map([["p", 1]]), new Map());
    expect(r.reservar).toEqual([{ ...pantalla, cantidad: 1 }]);
    expect(r.faltan).toEqual([{ ...pantalla, cantidad: 2 }]);
  });

  it("no aparta dos veces lo que la orden ya tenía", () => {
    expect(planearReserva([pantalla], new Map([["p", 1]]), new Map(), new Map([["p", 1]]))).toEqual({
      reservar: [],
      faltan: [],
    });
  });

  it("suma el mismo repuesto cotizado en dos líneas", () => {
    const r = planearReserva([pantalla, pantalla], new Map([["p", 5]]), new Map());
    expect(r.reservar).toEqual([{ ...pantalla, cantidad: 2 }]);
  });
});

describe("disponible", () => {
  it("resta lo apartado sin bajar de cero", () => {
    expect(disponible(3, 1)).toBe(2);
    expect(disponible(1, 2)).toBe(0);
  });
});
