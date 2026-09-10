import { describe, expect, it } from "vitest";
import { calcularDiferencia, efectivoEsperado, saldoEnCero, saldoPendiente } from "../lib/caja";

describe("efectivoEsperado", () => {
  it("suma la base inicial con las ventas en efectivo del turno", () => {
    expect(
      efectivoEsperado({
        baseInicial: 50000,
        ventasEfectivo: 320000,
        aperturasManualesEfectivo: 0,
      }),
    ).toBe(370000);
  });
});

describe("calcularDiferencia", () => {
  it("es cero cuando el efectivo contado coincide exactamente", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, aperturasManualesEfectivo: 0 };
    expect(calcularDiferencia(resumen, 150000)).toBe(0);
  });

  it("es positiva cuando sobra dinero", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, aperturasManualesEfectivo: 0 };
    expect(calcularDiferencia(resumen, 155000)).toBe(5000);
  });

  it("es negativa cuando falta dinero", () => {
    const resumen = { baseInicial: 50000, ventasEfectivo: 100000, aperturasManualesEfectivo: 0 };
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
