import { describe, expect, it } from "vitest";
import { codigoEntrada, numeroDesdeCodigoEntrada } from "../lib/codigo-entrada";

describe("código de entrada de la etiqueta", () => {
  it("prefijo de la empresa + número de orden con ceros, igual en recepción y reimpresión", () => {
    expect(codigoEntrada("PS", 13)).toBe("PS000013");
    expect(codigoEntrada(null, 7)).toBe("OR000007");
  });
});

describe("leer el código de entrada escaneado", () => {
  it("saca el número de orden del código de la etiqueta", () => {
    expect(numeroDesdeCodigoEntrada("PS", "PS000013")).toBe(13);
    expect(numeroDesdeCodigoEntrada("PS", " ps13 ")).toBe(13);
    expect(numeroDesdeCodigoEntrada(null, "OR000007")).toBe(7);
  });

  it("lo que no tiene esa forma se trata como serial", () => {
    expect(numeroDesdeCodigoEntrada("PS", "EQ-7K3QX9")).toBeNull();
    expect(numeroDesdeCodigoEntrada("PS", "PSX123")).toBeNull();
    expect(numeroDesdeCodigoEntrada("PS", "PS")).toBeNull();
    expect(numeroDesdeCodigoEntrada("PS", "PS000000")).toBeNull();
  });
});
