import { describe, expect, it } from "vitest";
import { claveCarrito, guardarCarrito, leerCarrito, type Almacen, type LineaGuardada } from "../lib/carrito-guardado";

function almacenFalso(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  };
}

const lineas: LineaGuardada[] = [
  { kind: "repuesto", repuestoId: "r1", descripcion: "Pantalla A10", cantidad: 2, precioUnit: 85000 },
  { kind: "articulo", articuloId: "a1", codigo: "EQ-7", descripcion: "Celular Samsung A15", precioUnit: 450000 },
];

describe("claveCarrito", () => {
  it("separa empresa, sede y usuario", () => {
    expect(claveCarrito("e1", "s1", "u1")).not.toBe(claveCarrito("e1", "s2", "u1"));
    expect(claveCarrito("e1", "s1", "u1")).not.toBe(claveCarrito("e1", "s1", "u2"));
    expect(claveCarrito("e1", null, "u1")).toBe("taller-saas:carrito:e1:sin-sede:u1");
  });
});

describe("guardarCarrito / leerCarrito", () => {
  it("lo que se guarda se vuelve a leer igual", () => {
    const a = almacenFalso();
    guardarCarrito(a, "k", lineas);
    expect(leerCarrito(a, "k")).toEqual(lineas);
  });

  it("un carrito vacío borra la clave", () => {
    const a = almacenFalso();
    guardarCarrito(a, "k", lineas);
    guardarCarrito(a, "k", []);
    expect(a.datos.has("k")).toBe(false);
    expect(leerCarrito(a, "k")).toEqual([]);
  });

  it("descarta lo que no entiende sin romperse", () => {
    const a = almacenFalso();
    a.setItem("roto", "{no es json");
    a.setItem("objeto", '{"kind":"repuesto"}');
    a.setItem(
      "mezcla",
      JSON.stringify([lineas[0], { kind: "repuesto", repuestoId: "r2", descripcion: "x", cantidad: 0, precioUnit: 1 }, { kind: "otro" }, null]),
    );
    expect(leerCarrito(a, "roto")).toEqual([]);
    expect(leerCarrito(a, "objeto")).toEqual([]);
    expect(leerCarrito(a, "mezcla")).toEqual([lineas[0]]);
  });

  it("sin almacén (servidor o bloqueado) no hace nada", () => {
    expect(leerCarrito(null, "k")).toEqual([]);
    expect(() => guardarCarrito(null, "k", lineas)).not.toThrow();
  });

  it("si el almacén falla al escribir, no lanza", () => {
    const a: Almacen = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(() => guardarCarrito(a, "k", lineas)).not.toThrow();
  });
});
