import { describe, expect, it } from "vitest";
import { CLAVE_RECARGA, VENTANA_RECARGA_MS, debeRecargar, textoDelError } from "../lib/recarga-error";

function almacen(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => {
      datos[k] = v;
    },
  };
}

describe("debeRecargar", () => {
  it("recarga la primera vez y anota el intento", () => {
    const a = almacen();
    expect(debeRecargar(a, 1000)).toBe(true);
    expect(a.datos[CLAVE_RECARGA]).toBe("1000");
  });

  it("no recarga otra vez dentro de la ventana", () => {
    const a = almacen();
    debeRecargar(a, 1000);
    expect(debeRecargar(a, 1000 + VENTANA_RECARGA_MS - 1)).toBe(false);
  });

  it("vuelve a recargar pasada la ventana", () => {
    const a = almacen({ [CLAVE_RECARGA]: "1000" });
    expect(debeRecargar(a, 1000 + VENTANA_RECARGA_MS)).toBe(true);
  });

  it("sin almacenamiento, o si falla, no recarga sola", () => {
    expect(debeRecargar(null, 1000)).toBe(false);
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {},
    };
    expect(debeRecargar(roto, 1000)).toBe(false);
  });

  it("ignora una marca que no es número", () => {
    expect(debeRecargar(almacen({ [CLAVE_RECARGA]: "basura" }), 1000)).toBe(true);
  });
});

describe("textoDelError", () => {
  it("muestra nombre y mensaje", () => {
    expect(textoDelError(new TypeError("x is undefined"))).toBe("TypeError: x is undefined");
  });

  it("corta mensajes largos", () => {
    expect(textoDelError(new Error("a".repeat(500))).length).toBe(301);
  });
});
