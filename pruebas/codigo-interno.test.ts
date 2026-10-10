import { describe, expect, it } from "vitest";
import { codigoArticulo, copiasValidas, siguienteCodigoRepuesto } from "../lib/codigo-interno";

describe("siguienteCodigoRepuesto", () => {
  it("empieza en REP-000001 si no hay ninguno con ese formato", () => {
    expect(siguienteCodigoRepuesto([])).toBe("REP-000001");
    expect(siguienteCodigoRepuesto(["REP-LLA-001", "F-1023"])).toBe("REP-000001");
  });

  it("toma el mayor y le suma uno", () => {
    expect(siguienteCodigoRepuesto(["REP-000002", "REP-000010", "REP-LLA-001"])).toBe("REP-000011");
  });
});

describe("codigoArticulo", () => {
  it("rellena con ceros a seis dígitos", () => {
    expect(codigoArticulo(123)).toBe("ART-000123");
  });
});

describe("copiasValidas", () => {
  it("acepta enteros de 1 a 100", () => {
    expect(copiasValidas(1)).toBe(1);
    expect(copiasValidas("5")).toBe(5);
    expect(copiasValidas(100)).toBe(100);
  });

  it("rechaza cero, negativos, decimales y más de 100", () => {
    for (const v of [0, -1, 1.5, 101, "abc", undefined]) expect(copiasValidas(v)).toBeNull();
  });
});
