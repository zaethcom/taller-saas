import { describe, expect, it } from "vitest";
import { generarSerialEquipo } from "../lib/serial-equipo";

describe("serial generado para un equipo nuevo", () => {
  it("tiene la forma EQ-XXXXXX sin caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) expect(generarSerialEquipo()).toMatch(/^EQ-[2-9A-HJKMNP-Z]{6}$/);
  });

  it("no se repite en una tanda", () => {
    const vistos = new Set(Array.from({ length: 1000 }, generarSerialEquipo));
    expect(vistos.size).toBe(1000);
  });
});
