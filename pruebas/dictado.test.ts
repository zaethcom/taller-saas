import { describe, expect, it } from "vitest";
import { unirDictado } from "../lib/dictado";

describe("unirDictado", () => {
  it("en un campo vacío empieza con mayúscula", () => {
    expect(unirDictado("", "pantalla rota")).toBe("Pantalla rota");
  });
  it("sigue lo escrito con un espacio", () => {
    expect(unirDictado("Pantalla rota", "y no carga")).toBe("Pantalla rota y no carga");
  });
  it("después de un punto empieza otra oración", () => {
    expect(unirDictado("Pantalla rota. ", "no carga")).toBe("Pantalla rota. No carga");
  });
  it("respeta el salto de línea", () => {
    expect(unirDictado("Pantalla rota\n", "no carga")).toBe("Pantalla rota\nNo carga");
  });
  it("ignora un dictado vacío", () => {
    expect(unirDictado("Algo", "  ")).toBe("Algo");
  });
});
