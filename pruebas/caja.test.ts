import { describe, expect, it } from "vitest";
import { calcularDiferencia, efectivoEsperado, saldoEnCero, saldoPendiente, totalesMovimientos } from "../lib/caja";

describe("efectivoEsperado", () => {
  it("suma la base inicial con las ventas en efectivo del turno", () => {
    expect(
      efectivoEsperado({
        baseInicial: 50000,
        ventasEfectivo: 320000,
        ingresosEfectivo: 0, salidasEfectivo: 0,
      }),
    ).toBe(370000);
  });

  it("suma lo que se ingresó y resta lo que se sacó de la caja", () => {
    expect(
      efectivoEsperado({ baseInicial: 50000, ventasEfectivo: 100000, ingresosEfectivo: 20000, salidasEfectivo: 35000 }),
    ).toBe(135000);
  });
});

describe("totalesMovimientos", () => {
  it("separa ingresos de salidas", () => {
    expect(
      totalesMovimientos([
        { tipo: "ingreso", monto: 20000 },
        { tipo: "salida", monto: 15000 },
        { tipo: "salida", monto: 5000 },
      ]),
    ).toEqual({ ingresos: 20000, salidas: 20000 });
  });

  it("sin movimientos, todo en cero", () => {
    expect(totalesMovimientos([])).toEqual({ ingresos: 0, salidas: 0 });
  });
});

describe("calcularDiferencia", () => {
  it("es cero cuando el efectivo contado coincide exactamente", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, ingresosEfectivo: 0, salidasEfectivo: 0 };
    expect(calcularDiferencia(resumen, 150000)).toBe(0);
  });

  it("es positiva cuando sobra dinero", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, ingresosEfectivo: 0, salidasEfectivo: 0 };
    expect(calcularDiferencia(resumen, 155000)).toBe(5000);
  });

  it("es negativa cuando falta dinero", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, ingresosEfectivo: 0, salidasEfectivo: 0 };
    expect(calcularDiferencia(resumen, 145000)).toBe(-5000);
  });
});

describe("saldoPendiente / saldoEnCero", () => {
  it("el saldo pendiente es la diferencia entre cotizado y pagado", () => {
    expect(saldoPendiente(100000, 40000)).toBe(60000);
  });

  it("nunca es negativo, aunque se haya pagado de más", () => {
    expect(saldoPendiente(100000, 150000)).toBe(0);
  });

  it("saldoEnCero es true solo cuando no queda nada por cobrar", () => {
    expect(saldoEnCero(100000, 100000)).toBe(true);
    expect(saldoEnCero(100000, 99999)).toBe(false);
  });
});
