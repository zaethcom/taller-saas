import { describe, expect, it } from "vitest";
import { cargaComprobanteRecepcion, type DatosComprobante } from "../lib/comprobante-recepcion";
import { puede } from "../lib/permisos";

const base: DatosComprobante = {
  numero: 14,
  prefijoEtiqueta: null,
  abiertaEn: "2026-10-22T15:00:00Z",
  motivo: "Pantalla rota",
  tokenPublico: "abc",
  telefonoAlterno: "3009998877",
  cliente: { nombre: "Ana", telefono: "3001234567" },
  producto: { serial: "SN1", tipo: "celular", marca: "Samsung", modelo: "A15" },
  cuenta: null,
};

describe("reimprimir comprobante de recepción", () => {
  it("usa los datos que tiene la orden ahora", () => {
    const c = cargaComprobanteRecepcion(base, "https://taller360.app");
    expect(c).toMatchObject({
      numeroOrden: 14,
      clienteNombre: "Ana",
      clienteTelefono: "3001234567",
      producto: "Samsung A15",
      serial: "SN1",
      motivo: "Pantalla rota",
      urlSeguimiento: "https://taller360.app/seguimiento/abc",
      valorServicio: null,
      abono: null,
      saldo: null,
    });
  });

  it("sin teléfono del cliente imprime el alternativo", () => {
    const c = cargaComprobanteRecepcion({ ...base, cliente: { nombre: "Ana", telefono: null } }, "");
    expect(c.clienteTelefono).toBe("3009998877");
  });

  it("valor, abonos y saldo salen de la cuenta de la orden", () => {
    const pago = (monto: number, medio: string) => ({ ventaId: medio + monto, numero: 1, tipo: "anticipo", monto, medio, fecha: "" });
    const c = cargaComprobanteRecepcion(
      { ...base, cuenta: { valor: 100000, pagado: 50000, saldo: 50000, pagos: [pago(30000, "Efectivo"), pago(20000, "Nequi")] } },
      "",
    );
    expect(c.valorServicio).toBe(100000);
    expect(c.abono).toEqual({ monto: 50000, medio: "varios" });
    expect(c.saldo).toBe(50000);
  });

  it("recepción y admin pueden reimprimirlo; el cajero no", () => {
    expect(puede("recepcion", "reimprimir_comprobante_orden")).toBe(true);
    expect(puede("admin", "reimprimir_comprobante_orden")).toBe(true);
    expect(puede("cajero", "reimprimir_comprobante_orden")).toBe(false);
  });
});
