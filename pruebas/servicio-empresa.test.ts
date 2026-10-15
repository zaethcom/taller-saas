import { describe, expect, it } from "vitest";
import {
  esFechaIso,
  estadoServicio,
  hoyIso,
  inicioDelPago,
  sumarMeses,
  textoEstadoServicio,
} from "../lib/servicio-empresa";

describe("sumarMeses", () => {
  it("suma meses dentro del mismo año y cruzando de año", () => {
    expect(sumarMeses("2026-10-10", 1)).toBe("2026-11-10");
    expect(sumarMeses("2026-10-10", 6)).toBe("2027-04-10");
    expect(sumarMeses("2026-10-10", 12)).toBe("2027-10-10");
  });

  it("si el día no existe en el mes destino, queda en el último del mes", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(sumarMeses("2026-08-31", 1)).toBe("2026-09-30");
  });
});

describe("inicioDelPago", () => {
  it("si el servicio sigue vigente, el pago se suma al final", () => {
    expect(inicioDelPago("2026-11-05", "2026-10-10")).toBe("2026-11-05");
  });

  it("si ya venció o no tiene fecha, cuenta desde hoy", () => {
    expect(inicioDelPago("2026-09-01", "2026-10-10")).toBe("2026-10-10");
    expect(inicioDelPago(null, "2026-10-10")).toBe("2026-10-10");
  });
});

describe("estadoServicio", () => {
  const hoy = "2026-10-10";

  it("sin fecha de fin", () => {
    expect(estadoServicio(null, hoy)).toEqual({ tipo: "sin_fecha" });
  });

  it("vencido desde el día siguiente al fin", () => {
    expect(estadoServicio("2026-10-09", hoy)).toEqual({ tipo: "vencido", dias: 1 });
    expect(textoEstadoServicio(estadoServicio("2026-10-01", hoy))).toBe("Vencido hace 9 días");
  });

  it("avisa desde 7 días antes, incluido el mismo día", () => {
    expect(textoEstadoServicio(estadoServicio("2026-10-10", hoy))).toBe("Vence hoy");
    expect(textoEstadoServicio(estadoServicio("2026-10-11", hoy))).toBe("Vence mañana");
    expect(estadoServicio("2026-10-17", hoy)).toEqual({ tipo: "por_vencer", dias: 7 });
    expect(estadoServicio("2026-10-18", hoy)).toEqual({ tipo: "al_dia", dias: 8 });
  });
});

describe("hoyIso", () => {
  it("usa la hora de Colombia, no la UTC", () => {
    // 2 a. m. UTC del 11 = 9 p. m. del 10 en Bogotá.
    expect(hoyIso(new Date("2026-10-11T02:00:00Z"))).toBe("2026-10-10");
  });
});

describe("esFechaIso", () => {
  it("acepta solo fechas reales AAAA-MM-DD", () => {
    expect(esFechaIso("2026-02-28")).toBe(true);
    expect(esFechaIso("2026-02-30")).toBe(false);
    expect(esFechaIso("10/10/2026")).toBe(false);
    expect(esFechaIso(null)).toBe(false);
  });
});
