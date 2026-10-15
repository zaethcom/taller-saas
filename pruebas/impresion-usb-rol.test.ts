import { describe, expect, it } from "vitest";
import { puestoPara, rolSugerido } from "../lib/impresion-usb";

describe("rolSugerido", () => {
  it("Zebra y Argox van a etiquetas", () => {
    expect(rolSugerido({ vendorId: 0x0a5f, productName: "ZTC ZP 500" })).toBe("etiquetas");
    expect(rolSugerido({ vendorId: 0x1664, productName: "OS-214" })).toBe("etiquetas");
  });
  it("una térmica de recibos va a tickets", () => {
    expect(rolSugerido({ vendorId: 0x0525, productName: "SEWOO SLK-T20" })).toBe("tickets");
  });
  it("reconoce etiquetadoras por el nombre", () => {
    expect(rolSugerido({ vendorId: 0x1234, productName: "Label Printer" })).toBe("etiquetas");
  });
});

describe("puestoPara", () => {
  it("usa el otro puesto si el sugerido está ocupado", () => {
    expect(puestoPara({ vendorId: 0x0525, productName: "POS-80" }, { tickets: {} })).toBe("etiquetas");
  });
  it("con los dos ocupados reemplaza el sugerido", () => {
    expect(puestoPara({ vendorId: 0x0a5f }, { tickets: {}, etiquetas: {} })).toBe("etiquetas");
  });
});
