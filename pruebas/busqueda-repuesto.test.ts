import { describe, expect, it } from "vitest";
import { filtroPalabra, palabrasBusqueda } from "../lib/busqueda-repuesto";

describe("búsqueda de repuestos por palabras", () => {
  it("separa las palabras para que no tengan que estar juntas", () => {
    expect(palabrasBusqueda("  pantalla   A10 ")).toEqual(["pantalla", "A10"]);
  });

  it("quita lo que rompería el filtro de PostgREST", () => {
    expect(palabrasBusqueda("flex (carga), A10%")).toEqual(["flex", "carga", "A10"]);
    expect(palabrasBusqueda(",,,")).toEqual([]);
  });

  it("cada palabra se busca en código, descripción, marca, modelo y categoría", () => {
    expect(filtroPalabra("a10")).toBe("codigo.ilike.%a10%,descripcion.ilike.%a10%,marca.ilike.%a10%,modelo.ilike.%a10%");
    expect(filtroPalabra("pantalla", ["c1", "c2"])).toContain("categoria_id.in.(c1,c2)");
  });
});
