import { describe, expect, it } from "vitest";
import {
  claveCarrito,
  guardarCarrito,
  guardarCliente,
  leerCarrito,
  leerCliente,
  type Almacen,
  type LineaGuardada,
} from "../lib/carrito-guardado";

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

describe("guardarCliente / leerCliente", () => {
  it("guarda el cliente al lado del carrito y lo vuelve a leer", () => {
    const a = almacenFalso();
    const cliente = { id: "c1", nombre: "Ana Pérez", documento: "1023456", telefono: null };
    guardarCliente(a, "k", cliente);
    expect(a.datos.has("k:cliente")).toBe(true);
    expect(leerCliente(a, "k")).toEqual(cliente);
  });

  it("un cliente nuevo (sin id) también se conserva", () => {
    const a = almacenFalso();
    guardarCliente(a, "k", { id: null, nombre: "Luis", documento: null, telefono: "3001234567" });
    expect(leerCliente(a, "k")).toEqual({ id: null, nombre: "Luis", documento: null, telefono: "3001234567" });
  });

  it("consumidor final borra la clave", () => {
    const a = almacenFalso();
    guardarCliente(a, "k", { id: "c1", nombre: "Ana", documento: null, telefono: null });
    guardarCliente(a, "k", null);
    expect(a.datos.has("k:cliente")).toBe(false);
    expect(leerCliente(a, "k")).toBeNull();
  });

  it("descarta lo que no entiende", () => {
    const a = almacenFalso();
    a.setItem("k:cliente", "{roto");
    expect(leerCliente(a, "k")).toBeNull();
    a.setItem("k:cliente", JSON.stringify({ id: 5, nombre: "X" }));
    expect(leerCliente(a, "k")).toBeNull();
    a.setItem("k:cliente", JSON.stringify({ id: "c1", nombre: "  " }));
    expect(leerCliente(a, "k")).toBeNull();
  });
});
