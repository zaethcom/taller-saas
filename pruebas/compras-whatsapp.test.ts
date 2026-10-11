import { describe, expect, it } from "vitest";
import { enlaceWhatsapp, equipoTexto, mensajePedido, normalizarTelefonoWhatsapp } from "../lib/compras/whatsapp";

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
        { descripcion: "Pantalla", cantidad: 1, ordenNumero: 45, prioridad: "urgente", equipo: "Celular Samsung A12" },
        { descripcion: "Pin de carga", cantidad: 2, ordenNumero: null, prioridad: "normal" },
      ],
      "Mensajero",
    );
    expect(texto).toBe(
      "Hola Mensajero, pedido de repuestos:\n• Pantalla x1 para Celular Samsung A12 (orden #45, prioridad urgente)\n• Pin de carga x2 (prioridad normal)",
    );
  });
});

describe("enlaceWhatsapp", () => {
  it("arma un enlace wa.me con el texto codificado", () => {
    expect(enlaceWhatsapp("+57 300", "a b")).toBe("https://wa.me/57300?text=a%20b");
  });
});

describe("equipoTexto", () => {
  it("junta tipo, marca y modelo, saltando lo que falta", () => {
    expect(equipoTexto({ tipo: "patineta", marca: "Xiaomi", modelo: "M365 Pro" })).toBe("Patineta Xiaomi M365 Pro");
    expect(equipoTexto({ tipo: "celular", marca: null, modelo: "A12" })).toBe("Celular A12");
    expect(equipoTexto(null)).toBe("");
  });
});
