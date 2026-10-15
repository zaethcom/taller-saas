import { describe, expect, it } from "vitest";
import { destinoWhatsappOrden, mensajeSeguimiento } from "../lib/orden-whatsapp";

describe("destinoWhatsappOrden", () => {
  it("prefiere el número alternativo", () => {
    expect(destinoWhatsappOrden("310 111 2222", "300 123 4567")).toEqual({ numero: "573101112222", destino: "alterno" });
  });
  it("usa el teléfono del cliente si no hay alternativo", () => {
    expect(destinoWhatsappOrden(null, "300 123 4567")).toEqual({ numero: "573001234567", destino: "cliente" });
    expect(destinoWhatsappOrden("  ", "300 123 4567")?.destino).toBe("cliente");
  });
  it("devuelve null sin ningún número válido", () => {
    expect(destinoWhatsappOrden(null, "12")).toBeNull();
  });
});

describe("mensajeSeguimiento", () => {
  const url = "https://x.app/seguimiento/abc";
  it("pide autorización cuando la orden espera aprobación", () => {
    const m = mensajeSeguimiento({ nombre: "Ana María Pérez", estado: "esperando_aprobacion", equipo: "Samsung A54", empresa: "Cell Fix", url });
    expect(m).toBe(
      `Hola Ana, te escribimos de Cell Fix. Tu equipo Samsung A54 necesita tu autorización para continuar. Revisa el diagnóstico y la cotización, y apruébala aquí: ${url}`,
    );
  });
  it("avisa que el equipo está listo para recoger", () => {
    expect(mensajeSeguimiento({ nombre: "Luis", estado: "listo_entrega", equipo: "iPhone 12", url })).toBe(
      `Hola Luis. Tu equipo iPhone 12 ya está listo para recoger. Aquí ves el detalle y el saldo: ${url}`,
    );
  });
  it("invita a revisar el avance en los demás estados", () => {
    expect(mensajeSeguimiento({ nombre: "", estado: "en_reparacion", url })).toBe(
      `Hola. Por favor revisa cómo va tu equipo en este enlace: ${url}`,
    );
  });
});
