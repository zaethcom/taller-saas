import { describe, expect, it } from "vitest";
import { empresaIncluyeTaller, esPantallaDeTaller } from "../lib/taller-activo";
import type { SupabaseClient } from "@supabase/supabase-js";

function clienteFalso(respuesta: { data: unknown; error: unknown }) {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: async () => respuesta,
  };
  return { from: () => consulta } as unknown as SupabaseClient;
}

describe("pantallas de taller", () => {
  it("reconoce las pantallas de taller y sus subpantallas", () => {
    for (const r of ["/recibir", "/entregar", "/abonos", "/ordenes", "/ordenes/abc/editar", "/orden/1/cotizacion", "/escanear", "/equipos", "/servicios", "/mano-obra"]) {
      expect(esPantallaDeTaller(r)).toBe(true);
    }
  });

  it("deja el POS, inventario y lo demás", () => {
    for (const r of ["/vender", "/turno", "/recibos", "/inventario", "/compras", "/clientes", "/reportes", "/ordenes-x", "/configuracion"]) {
      expect(esPantallaDeTaller(r)).toBe(false);
    }
  });
});

describe("empresaIncluyeTaller", () => {
  it("lee la columna de la empresa", async () => {
    expect(await empresaIncluyeTaller(clienteFalso({ data: { incluye_taller: false }, error: null }), "e")).toBe(false);
    expect(await empresaIncluyeTaller(clienteFalso({ data: { incluye_taller: true }, error: null }), "e")).toBe(true);
  });

  it("ante un error (migración sin correr) deja el taller como antes", async () => {
    expect(await empresaIncluyeTaller(clienteFalso({ data: null, error: { message: "column does not exist" } }), "e")).toBe(true);
  });
});
