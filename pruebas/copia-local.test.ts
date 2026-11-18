import { describe, expect, it } from "vitest";
import { buscarArticulosLocal, buscarClientesLocal, buscarRepuestosLocal, LIMITE_BUSQUEDA } from "../lib/sin-conexion/busqueda-local";
import { respuestaDesdeCopia } from "../lib/sin-conexion/leer-api";
import type { CopiaLocal, RepuestoLocal } from "../lib/sin-conexion/tipos";

function repuesto(p: Partial<RepuestoLocal> & { id: string }): RepuestoLocal {
  return {
    codigo: p.id.toUpperCase(),
    descripcion: "",
    marca: null,
    modelo: null,
    categoriaId: null,
    precioVenta: 1000,
    imagenUrl: null,
    existenciaAqui: 1,
    reservadoAqui: 0,
    ...p,
  };
}

const copia: CopiaLocal = {
  version: 1,
  generadaEn: "2026-11-18T20:00:00.000Z",
  empresaId: "e1",
  sedeId: "s1",
  usuarioId: "u1",
  repuestos: [
    repuesto({ id: "r1", descripcion: "Pantalla Galaxy A10 OLED", marca: "Samsung", categoriaId: "c1" }),
    repuesto({ id: "r2", descripcion: "Batería iPhone 11", categoriaId: "c2" }),
    repuesto({ id: "r3", descripcion: "Vidrio templado", modelo: "A10", existenciaAqui: 0 }),
    repuesto({ id: "r4", descripcion: "Flex de carga", categoriaId: "c1" }),
  ],
  articulos: [
    { id: "a1", numero: 12, codigo: "ART-000012", tipo: "Celular", marca: "Xiaomi", modelo: "Redmi 9", numero_serie: "IMEI123", precio_venta: 500000, imagen_url: null, categoriaId: null },
    { id: "a2", numero: 13, codigo: "ART-000013", tipo: "Patineta", marca: "Xiaomi", modelo: "M365", numero_serie: null, precio_venta: 1500000, imagen_url: null, categoriaId: "c9" },
  ],
  clientes: [
    { id: "k1", nombre: "Ana María Pérez", documento: "1.023.456.789", telefono: "+57 300 123 4567", correo: null },
    { id: "k2", nombre: "Pedro Gómez", documento: null, telefono: "3109876543", correo: null },
  ],
  ordenesAbiertas: [],
  categorias: [
    { id: "c1", nombre: "Pantallas" },
    { id: "c2", nombre: "Baterías" },
  ],
  metodosPago: [
    { id: "m1", nombre: "Efectivo", es_efectivo: true, activo: true },
    { id: "m2", nombre: "Viejo", es_efectivo: false, activo: false },
  ],
  turno: { abierto: true, turnoId: "t1" },
};

describe("buscarRepuestosLocal", () => {
  it("cada palabra en cualquier campo, sin importar el orden ni mayúsculas", () => {
    expect(buscarRepuestosLocal(copia, "a10 PANTALLA").map((r) => r.id)).toEqual(["r1"]);
    expect(buscarRepuestosLocal(copia, "samsung").map((r) => r.id)).toEqual(["r1"]);
  });
  it("encuentra por nombre de categoría", () => {
    expect(buscarRepuestosLocal(copia, "baterías").map((r) => r.id)).toEqual(["r2"]);
    expect(buscarRepuestosLocal(copia, "pantallas").map((r) => r.id)).toEqual(["r1", "r4"]);
  });
  it("nunca ofrece lo que no tiene existencia", () => {
    expect(buscarRepuestosLocal(copia, "vidrio")).toEqual([]);
  });
  it("filtra por pestaña de categoría y sin texto lista todo", () => {
    expect(buscarRepuestosLocal(copia, "", "c1").map((r) => r.id)).toEqual(["r1", "r4"]);
    expect(buscarRepuestosLocal(copia, "").length).toBe(3);
  });
  it("como el servidor, devuelve máximo 15", () => {
    const muchos = { ...copia, repuestos: Array.from({ length: 40 }, (_, i) => repuesto({ id: `x${i}`, descripcion: "cable" })) };
    expect(buscarRepuestosLocal(muchos, "cable").length).toBe(LIMITE_BUSQUEDA);
  });
});

describe("buscarArticulosLocal", () => {
  it("con número busca por número de artículo", () => {
    expect(buscarArticulosLocal(copia, "ART-000013").map((a) => a.id)).toEqual(["a2"]);
  });
  it("sin número busca en tipo, marca, modelo y serie", () => {
    expect(buscarArticulosLocal(copia, "xiaomi").map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(buscarArticulosLocal(copia, "imei").map((a) => a.id)).toEqual(["a1"]);
  });
  it("respeta la categoría", () => {
    expect(buscarArticulosLocal(copia, "", "c9").map((a) => a.id)).toEqual(["a2"]);
  });
});

describe("buscarClientesLocal", () => {
  it("por documento con puntos o sin ellos y por celular con o sin +57", () => {
    expect(buscarClientesLocal(copia.clientes, "1023456789", false).map((c) => c.id)).toEqual(["k1"]);
    expect(buscarClientesLocal(copia.clientes, "3001234567", false).map((c) => c.id)).toEqual(["k1"]);
  });
  it("por nombre solo si se pide", () => {
    expect(buscarClientesLocal(copia.clientes, "pedro", false)).toEqual([]);
    expect(buscarClientesLocal(copia.clientes, "pedro", true).map((c) => [c.id, c.coincide])).toEqual([["k2", "nombre"]]);
  });
});

describe("respuestaDesdeCopia", () => {
  it("responde las URLs de Vender en la misma forma que el servidor", () => {
    expect((respuestaDesdeCopia(copia, "/api/repuestos?venta=1&buscar=a10") as RepuestoLocal[]).map((r) => r.id)).toEqual(["r1"]);
    expect((respuestaDesdeCopia(copia, "/api/inventario/articulos?disponibles=1&buscar=&categoriaId=c9") as { id: string }[]).map((a) => a.id)).toEqual(["a2"]);
    expect(respuestaDesdeCopia(copia, "/api/categorias")).toEqual(copia.categorias);
    expect((respuestaDesdeCopia(copia, "/api/metodos-pago") as { id: string }[]).map((m) => m.id)).toEqual(["m1"]);
    expect(respuestaDesdeCopia(copia, "/api/turno/actual")).toEqual({ abierto: true, turnoId: "t1" });
    expect(respuestaDesdeCopia(copia, "/api/clientes?nombre=1&q=ana")).toEqual({
      clientes: [expect.objectContaining({ id: "k1", coincide: "nombre" })],
    });
  });
  it("no inventa respuestas para lo que la copia no cubre", () => {
    expect(respuestaDesdeCopia(copia, "/api/repuestos?buscar=a10")).toBeNull();
    expect(respuestaDesdeCopia(copia, "/api/ventas")).toBeNull();
    expect(respuestaDesdeCopia(copia, "/api/clientes")).toBeNull();
  });
});
