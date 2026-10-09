import { describe, expect, it } from "vitest";
import { enlaceWhatsapp, mensajePedido, normalizarTelefonoWhatsapp } from "../lib/compras/whatsapp";

describe("normalizarTelefonoWhatsapp", () => {
  it("deja solo dígitos", () => {
    expect(normalizarTelefonoWhatsapp("+57 300 123-4567")).toBe("573001234567");
  });
  it("rechaza números demasiado cortos", () => {
    expect(normalizarTelefonoWhatsapp("12-34")).toBeNull();
  });
});

describe("mensajePedido", () => {
  it("saluda al destinatario y lista cada faltante", () => {
    const texto = mensajePedido(
      [
        { descripcion: "Pantalla A12", cantidad: 1, ordenNumero: 45, prioridad: "urgente" },
        { descripcion: "Pin de carga", cantidad: 2, ordenNumero: null, prioridad: "normal" },
      ],
      "Mensajero",
    );
    expect(texto).toBe(
      "Hola Mensajero, pedido de repuestos:\n• Pantalla A12 x1 (orden #45, prioridad urgente)\n• Pin de carga x2 (prioridad normal)",
    );
  });
});

describe("enlaceWhatsapp", () => {
  it("arma un enlace wa.me con el texto codificado", () => {
    expect(enlaceWhatsapp("+57 300", "a b")).toBe("https://wa.me/57300?text=a%20b");
  });
});
