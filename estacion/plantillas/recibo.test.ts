import { describe, expect, it } from "vitest";
import { reciboVenta, type CargaReciboVenta } from "./recibo";
import { inicializar, abrirCajon } from "../escpos";

const BASE: CargaReciboVenta = {
  numeroVenta: 1,
  items: [{ descripcion: "Repuesto", cantidad: 1, precioUnit: 1000 }],
  total: 1000,
  medioPago: "Efectivo",
  abreCajon: true,
  empresaNombre: "Taller",
  empresaDireccion: null,
  empresaTelefono: null,
  reciboPie: "Gracias",
};

describe("reciboVenta() -- imprimir desmarcado", () => {
  it("con imprimir=false y abreCajon=true, solo manda init + el pulso del cajón", () => {
    const buf = reciboVenta({ ...BASE, imprimir: false });
    expect(buf).toEqual(Buffer.concat([inicializar(), abrirCajon()]));
  });

  it("con imprimir=false y abreCajon=false, no manda nada más que init", () => {
    const buf = reciboVenta({ ...BASE, imprimir: false, abreCajon: false });
    expect(buf).toEqual(inicializar());
  });

  it("sin imprimir (undefined) se comporta como true -- imprime el ticket completo", () => {
    const conDefault = reciboVenta(BASE);
    const conTrueExplicito = reciboVenta({ ...BASE, imprimir: true });
    expect(conDefault).toEqual(conTrueExplicito);
    expect(conDefault.length).toBeGreaterThan(inicializar().length + abrirCajon().length);
  });
});
