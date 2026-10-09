import { describe, expect, it } from "vitest";
import { codigoEntrada } from "../lib/codigo-entrada";

describe("código de entrada de la etiqueta", () => {
  it("prefijo de la empresa + número de orden con ceros, igual en recepción y reimpresión", () => {
    expect(codigoEntrada("PS", 13)).toBe("PS000013");
    expect(codigoEntrada(null, 7)).toBe("OR000007");
  });
});
