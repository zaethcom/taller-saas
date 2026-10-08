import { describe, expect, it } from "vitest";
import { configEstacion, estadoConexion } from "../lib/estacion-estado";

describe("estadoConexion", () => {
  const ahora = new Date("2026-10-08T12:00:00Z");

  it("sin ningún contacto todavía es 'nunca'", () => {
    expect(estadoConexion(null, ahora)).toBe("nunca");
    expect(estadoConexion(undefined, ahora)).toBe("nunca");
  });

  it("un contacto de hace menos de dos minutos está en línea", () => {
    // El latido se anota cada 30 s: un minuto y medio es normal.
    expect(estadoConexion("2026-10-08T11:58:30Z", ahora)).toBe("en_linea");
  });

  it("más de dos minutos sin contacto es sin conexión", () => {
    expect(estadoConexion("2026-10-08T11:57:00Z", ahora)).toBe("sin_conexion");
  });
});

describe("configEstacion", () => {
  it("arma el config.json que lee estacion/index.ts", () => {
    expect(
      configEstacion({ sedeId: "s1", apiBase: "https://taller-saas-mvp.vercel.app/", clave: "abc" }),
    ).toEqual({
      sedeId: "s1",
      apiBase: "https://taller-saas-mvp.vercel.app",
      servicioClave: "abc",
      intervaloMs: 2000,
    });
  });
});
