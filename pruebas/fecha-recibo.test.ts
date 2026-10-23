import { describe, expect, it } from "vitest";
import { fechaHoraRecibo } from "../lib/fecha-recibo";
import { reciboVenta } from "../estacion/plantillas/recibo";

describe("fechaHoraRecibo()", () => {
  it("fecha y hora en hora de Colombia, solo con caracteres que la impresora imprime", () => {
    // 2026-10-23T00:39Z = 22 de octubre, 7:39 p. m. en Bogotá
    const t = fechaHoraRecibo("2026-10-23T00:39:00Z");
    expect(t.startsWith("22/10/2026 7:39")).toBe(true);
    expect(/^[\x20-\x7e]+$/.test(t)).toBe(true);
  });
});

describe("reciboVenta() -- fecha", () => {
  it("imprime la fecha y hora debajo del número de venta", () => {
    const txt = reciboVenta({
      numeroVenta: 62,
      fecha: "22/10/2026 7:39 p. m.",
      items: [{ descripcion: "Repuesto", cantidad: 1, precioUnit: 1000 }],
      total: 1000,
      medioPago: "Efectivo",
      abreCajon: false,
      empresaNombre: "Taller",
      empresaDireccion: null,
      empresaTelefono: null,
      reciboPie: "Gracias",
    }).toString("latin1");
    expect(txt).toMatch(/Venta #62[\s\S]{0,12}\n22\/10\/2026 7:39 p\. m\.\n/);
  });
});
