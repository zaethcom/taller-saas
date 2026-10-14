import { describe, expect, it } from "vitest";
import { clientesCoincidentes, pareceCelular, sePuedeBuscarCliente, type ClienteBuscado } from "../lib/busqueda-cliente";

const ana: ClienteBuscado = { id: "a", nombre: "Ana", documento: "1.023.456.789", telefono: "+57 300-123-4567", correo: null };
const beto: ClienteBuscado = { id: "b", nombre: "Beto", documento: "79876543", telefono: "310 555 1234567", correo: null };

describe("buscar cliente al recibir", () => {
  it("encuentra por documento sin importar puntos", () => {
    expect(clientesCoincidentes([ana, beto], "1023456789").map((c) => c.id)).toEqual(["a"]);
    expect(clientesCoincidentes([ana], "1023456789")[0]?.coincide).toBe("documento");
  });

  it("encuentra por teléfono con o sin indicativo y separadores", () => {
    expect(clientesCoincidentes([ana, beto], "300 123 4567").map((c) => c.id)).toEqual(["a"]);
    expect(clientesCoincidentes([ana], "3001234567")[0]?.coincide).toBe("telefono");
  });

  it("un documento corto no trae a quien tiene un celular que termina igual", () => {
    expect(clientesCoincidentes([ana], "1234567")).toEqual([]);
  });

  it("no repite un cliente que llegó por las dos consultas", () => {
    expect(clientesCoincidentes([ana, ana], "1023456789")).toHaveLength(1);
  });

  it("decide cuándo buscar y si lo escrito es un celular", () => {
    expect(sePuedeBuscarCliente("123")).toBe(false);
    expect(sePuedeBuscarCliente("79876")).toBe(true);
    expect(pareceCelular("300 123 4567")).toBe(true);
    expect(pareceCelular("+57 300 123 4567")).toBe(true);
    expect(pareceCelular("1023456789")).toBe(false);
  });
});
