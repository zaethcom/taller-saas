import { describe, expect, it } from "vitest";
import { agruparModelos } from "../lib/modelos-equipo";

describe("agruparModelos", () => {
  it("agrupa por marca, sin repetidos y en orden natural", () => {
    expect(
      agruparModelos([
        { marca: "Samsung", modelo: "Galaxy A15" },
        { marca: "samsung", modelo: "galaxy a15" },
        { marca: "Samsung", modelo: "Galaxy A05" },
        { marca: "Apple", modelo: "iPhone 13" },
        { marca: "Apple", modelo: "iPhone 11" },
        { marca: " Xiaomi ", modelo: "Redmi  Note 13" },
      ]),
    ).toEqual([
      { marca: "Apple", modelos: ["iPhone 11", "iPhone 13"] },
      { marca: "Samsung", modelos: ["Galaxy A05", "Galaxy A15"] },
      { marca: "Xiaomi", modelos: ["Redmi Note 13"] },
    ]);
  });

  it("ignora filas sin marca o sin modelo", () => {
    expect(agruparModelos([{ marca: "Remax", modelo: null }, { marca: null, modelo: "X" }, { marca: "", modelo: "" }])).toEqual([]);
  });
});
