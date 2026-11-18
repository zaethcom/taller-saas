import { describe, expect, it } from "vitest";
import { claveLocalValida, esColumnaFaltante, horaSinConexion, MAXIMO_SIN_CONEXION_MS } from "../lib/sin-conexion/clave-local";
import { nuevaClaveLocal, resultadoEnvio } from "../lib/sin-conexion/cola";
import { aplicarVentaEnCopia, descripcionVenta, esFalloDeRed } from "../lib/sin-conexion/venta-local";
import type { CopiaLocal } from "../lib/sin-conexion/tipos";

describe("clave local", () => {
  it("acepta un uuid y rechaza lo demás", () => {
    expect(claveLocalValida(nuevaClaveLocal())).toBe(true);
    expect(claveLocalValida("123")).toBe(false);
    expect(claveLocalValida(undefined)).toBe(false);
    expect(claveLocalValida("'; drop table venta; --")).toBe(false);
  });
  it("reconoce la columna que falta cuando la migración no se ha corrido", () => {
    expect(esColumnaFaltante({ code: "42703" })).toBe(true);
    expect(esColumnaFaltante({ code: "PGRST204" })).toBe(true);
    expect(esColumnaFaltante({ code: "23505" })).toBe(false);
    expect(esColumnaFaltante(null)).toBe(false);
  });
});

describe("horaSinConexion", () => {
  const ahora = Date.parse("2026-11-18T20:00:00Z");
  it("acepta una hora de las últimas 72 horas", () => {
    expect(horaSinConexion("2026-11-18T15:30:00Z", ahora)).toBe("2026-11-18T15:30:00.000Z");
  });
  it("descarta horas en el futuro, demasiado viejas o inválidas", () => {
    expect(horaSinConexion("2026-11-18T21:00:00Z", ahora)).toBeNull();
    expect(horaSinConexion(new Date(ahora - MAXIMO_SIN_CONEXION_MS - 1000).toISOString(), ahora)).toBeNull();
    expect(horaSinConexion("ayer", ahora)).toBeNull();
    expect(horaSinConexion(12345, ahora)).toBeNull();
  });
  it("tolera un reloj unos minutos adelantado", () => {
    expect(horaSinConexion("2026-11-18T20:05:00Z", ahora)).not.toBeNull();
  });
});

describe("resultadoEnvio", () => {
  it("2xx sin avisos sale de la cola; con avisos queda para revisar", () => {
    expect(resultadoEnvio(200, { avisos: [] })).toBe("listo");
    expect(resultadoEnvio(200, null)).toBe("listo");
    expect(resultadoEnvio(200, { avisos: ["sin existencia"] })).toBe("aviso");
  });
  it("sesión vencida se reintenta; otros errores quedan para revisar", () => {
    expect(resultadoEnvio(401, null)).toBe("reintentar");
    expect(resultadoEnvio(409, { avisos: undefined })).toBe("error");
    expect(resultadoEnvio(500, null)).toBe("error");
  });
});

describe("aplicarVentaEnCopia", () => {
  const copia: CopiaLocal = {
    version: 1,
    generadaEn: "x",
    empresaId: "e",
    sedeId: "s",
    usuarioId: "u",
    repuestos: [
      { id: "r1", codigo: "R1", descripcion: "Cable", marca: null, modelo: null, categoriaId: null, precioVenta: 1, imagenUrl: null, existenciaAqui: 3, reservadoAqui: 0 },
      { id: "r2", codigo: "R2", descripcion: "Vidrio", marca: null, modelo: null, categoriaId: null, precioVenta: 1, imagenUrl: null, existenciaAqui: 1, reservadoAqui: 0 },
    ],
    articulos: [{ id: "a1", numero: 1, codigo: "ART-000001", tipo: "Celular", marca: null, modelo: null, numero_serie: null, precio_venta: 1, imagen_url: null, categoriaId: null }],
    clientes: [],
    ordenesAbiertas: [],
    categorias: [],
    metodosPago: [],
    turno: null,
  };
  it("descuenta existencia, saca lo agotado y los artículos vendidos sin tocar la original", () => {
    const despues = aplicarVentaEnCopia(copia, [
      { repuestoId: "r1", cantidad: 2 },
      { repuestoId: "r2", cantidad: 1 },
      { articuloId: "a1", cantidad: 1 },
    ]);
    expect(despues.repuestos).toEqual([expect.objectContaining({ id: "r1", existenciaAqui: 1 })]);
    expect(despues.articulos).toEqual([]);
    expect(copia.repuestos[0]!.existenciaAqui).toBe(3);
    expect(copia.articulos).toHaveLength(1);
  });
});

describe("venta sin conexión", () => {
  it("describe la venta para la lista de revisión", () => {
    expect(descripcionVenta(45000, 3)).toBe("Venta · $45.000 · 3 unidades");
    expect(descripcionVenta(1000, 1)).toBe("Venta · $1.000 · 1 unidad");
  });
  it("solo un fallo de red o una espera agotada cuentan como sin conexión", () => {
    expect(esFalloDeRed(new TypeError("Failed to fetch"))).toBe(true);
    expect(esFalloDeRed(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
    expect(esFalloDeRed(new Error("método de pago inválido"))).toBe(false);
  });
});
