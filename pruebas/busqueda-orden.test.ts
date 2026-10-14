import { describe, expect, it } from "vitest";
import {
  coincideDocumento,
  coincideTelefono,
  digitosTelefono,
  normalizarDocumento,
  numeroOrdenEscrito,
  ordenarResultados,
  patronFlexible,
} from "../lib/busqueda-orden";

describe("buscador de la barra superior", () => {
  it("un número corto es una orden, no un teléfono", () => {
    expect(numeroOrdenEscrito(" 14 ")).toBe(14);
    expect(digitosTelefono("14")).toBeNull();
    expect(numeroOrdenEscrito("ABC123")).toBeNull();
  });

  it("encuentra el teléfono sin importar espacios, guiones o indicativo", () => {
    const buscado = digitosTelefono("300 123 4567")!;
    expect(buscado).toBe("3001234567");
    expect(digitosTelefono("+57 300-123-4567")).toBe("3001234567");
    expect(coincideTelefono("300-123-4567", buscado)).toBe(true);
    expect(coincideTelefono("+57 3001234567", buscado)).toBe(true);
    expect(coincideTelefono("3001234568", buscado)).toBe(false);
    expect(coincideTelefono(null, buscado)).toBe(false);
  });

  it("encuentra el documento con o sin puntos", () => {
    const buscado = normalizarDocumento("1023456789");
    expect(coincideDocumento("1.023.456.789", buscado)).toBe(true);
    expect(coincideDocumento("1023456780", buscado)).toBe(false);
    expect(coincideDocumento(null, buscado)).toBe(false);
  });

  it("el filtro de la base deja pasar separadores entre dígitos", () => {
    expect(patronFlexible("300")).toBe("%3%0%0%");
  });

  it("las órdenes abiertas van primero, luego la más reciente", () => {
    const base = { coincide: ["telefono" as const] };
    const lista = ordenarResultados([
      { ...base, id: "a", numero: 1, abierta: false, abiertaEn: "2026-10-12" },
      { ...base, id: "b", numero: 2, abierta: true, abiertaEn: "2026-10-01" },
      { ...base, id: "c", numero: 3, abierta: true, abiertaEn: "2026-10-10" },
    ]);
    expect(lista.map((o) => o.id)).toEqual(["c", "b", "a"]);
  });
});
