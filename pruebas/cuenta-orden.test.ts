import { describe, expect, it } from "vitest";
import { resumirCuenta, valorOrden, type PagoOrden } from "../lib/cuenta-orden";
import { reciboVenta } from "../estacion/plantillas/recibo";
import { comprobanteRecepcion } from "../estacion/plantillas/comprobante";

const pago = (monto: number, tipo = "anticipo"): PagoOrden => ({
  ventaId: String(monto),
  numero: monto,
  tipo,
  monto,
  medio: "Efectivo",
  fecha: "2026-10-10T00:00:00Z",
});

describe("cuenta de la orden", () => {
  it("el valor es lo mayor entre lo registrado y la cotización vigente", () => {
    expect(valorOrden(50000, null)).toBe(50000);
    expect(valorOrden(50000, 120000)).toBe(120000);
    expect(valorOrden(150000, 120000)).toBe(150000);
  });

  it("los abonos descuentan el saldo y nunca queda negativo", () => {
    const cuenta = resumirCuenta(100000, null, [pago(30000), pago(20000)]);
    expect(cuenta).toMatchObject({ valor: 100000, pagado: 50000, saldo: 50000 });
    expect(resumirCuenta(100000, null, [pago(120000)]).saldo).toBe(0);
  });
});

const MARCA = { empresaNombre: "Taller", empresaDireccion: null, empresaTelefono: null, reciboPie: "Gracias" };

describe("impresión de abonos y saldo", () => {
  it("el recibo de un abono muestra el valor, lo abonado antes y el saldo", () => {
    const texto = reciboVenta({
      ...MARCA,
      numeroVenta: 7,
      items: [{ descripcion: "Abono orden #14", cantidad: 1, precioUnit: 20000 }],
      total: 20000,
      etiquetaTotal: "ABONO",
      medioPago: "Efectivo",
      abreCajon: false,
      cuentaOrden: { numeroOrden: 14, valor: 100000, abonadoAntes: 30000, estePago: 20000, saldo: 50000 },
    }).toString("latin1");
    expect(texto).toContain("ABONO $20.000");
    expect(texto).toContain("Abonado antes $30.000");
    expect(texto).toContain("SALDO $50.000");
  });

  it("el comprobante de recepción imprime valor, abono y saldo", () => {
    const texto = comprobanteRecepcion({
      ...MARCA,
      numeroOrden: 14,
      codigoEntrada: "OR14",
      clienteNombre: "Ana",
      clienteTelefono: null,
      producto: "Samsung A10",
      serial: "EQ-1",
      motivo: "Cambio de pantalla",
      fecha: "10/10/2026",
      urlSeguimiento: "https://x/seguimiento/t",
      valorServicio: 150000,
      abono: { monto: 50000, medio: "Nequi" },
      saldo: 100000,
    }).toString("latin1");
    expect(texto).toContain("VALOR DEL SERVICIO: $150.000");
    expect(texto).toContain("Abono: $50.000 (Nequi)");
    expect(texto).toContain("SALDO: $100.000");
  });

  it("sin valor del servicio, el comprobante no imprime cuenta", () => {
    const texto = comprobanteRecepcion({
      ...MARCA,
      numeroOrden: 1,
      codigoEntrada: "OR1",
      clienteNombre: "Ana",
      clienteTelefono: null,
      producto: "x",
      serial: "y",
      motivo: "z",
      fecha: "",
      urlSeguimiento: "",
    }).toString("latin1");
    expect(texto).not.toContain("SALDO");
  });
});
