import { describe, expect, it } from "vitest";
import {
  codigoArticulo,
  copiasValidas,
  normalizarCodigoEscaneado,
  numeroDeCodigoArticulo,
  siguienteCodigoRepuesto,
} from "../lib/codigo-interno";

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

describe("normalizarCodigoEscaneado", () => {
  it("quita espacios y caracteres de control que agregan los lectores", () => {
    expect(normalizarCodigoEscaneado("  rep-bat-001\r\n")).toBe("REP-BAT-001");
    expect(normalizarCodigoEscaneado("\x1dACC-BOL-001\t")).toBe("ACC-BOL-001");
  });
});

describe("numeroDeCodigoArticulo", () => {
  it("lee el número de un código de artículo", () => {
    expect(numeroDeCodigoArticulo("ART-000123")).toBe(123);
    expect(numeroDeCodigoArticulo("art123")).toBe(123);
  });

  it("no confunde un repuesto con un artículo", () => {
    expect(numeroDeCodigoArticulo("REP-000123")).toBeNull();
    expect(numeroDeCodigoArticulo("7701234567890")).toBeNull();
  });
});
