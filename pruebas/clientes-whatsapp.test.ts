import { describe, expect, it } from "vitest";
import { mensajeInicialCliente, numeroWhatsappCliente } from "../lib/clientes/whatsapp";

describe("numeroWhatsappCliente", () => {
  it("agrega el 57 a un celular colombiano sin indicativo", () => {
    expect(numeroWhatsappCliente("300 123 4567")).toBe("573001234567");
  });
  it("respeta un número que ya trae indicativo", () => {
    expect(numeroWhatsappCliente("+57 300 123-4567")).toBe("573001234567");
    expect(numeroWhatsappCliente("+1 305 555 0100")).toBe("13055550100");
  });
  it("devuelve null sin teléfono útil", () => {
    expect(numeroWhatsappCliente(null)).toBeNull();
    expect(numeroWhatsappCliente("")).toBeNull();
    expect(numeroWhatsappCliente("12-34")).toBeNull();
  });
});

describe("mensajeInicialCliente", () => {
  it("saluda por el primer nombre", () => {
    expect(mensajeInicialCliente("  Ana María Pérez ")).toBe("Hola Ana, ");
  });
  it("saluda sin nombre si está vacío", () => {
    expect(mensajeInicialCliente("")).toBe("Hola, ");
  });
});
