import { describe, expect, it } from "vitest";
import { clientesLocal, consultaDeRuta, existenciasLocal, ordenesLocal } from "../lib/sin-conexion/consultas-local";
import type { CopiaLocal, OrdenLocal } from "../lib/sin-conexion/tipos";

function orden(id: string, numero: number, cliente: string, serial: string): OrdenLocal {
  return {
    id,
    numero,
    estado: "en_proceso",
    abiertaEn: "2026-11-18T10:00:00.000Z",
    total: 0,
    telefonoAlterno: null,
    clienteId: null,
    serial,
    tipo: "Celular",
    marca: "Samsung",
    modelo: "A10",
    cuenta: {
      motivo: "No carga",
      tokenPublico: "",
      clienteNombre: cliente,
      clienteTelefono: "3001112233",
      valor: 0,
      pagado: 0,
      saldo: 0,
      pagos: [],
      items: [],
    },
  };
}

const copia: CopiaLocal = {
  version: 1,
  generadaEn: "2026-11-19T10:00:00.000Z",
  empresaId: "e",
  sedeId: "s",
  usuarioId: "u",
  repuestos: [
    { id: "r1", codigo: "R-1", descripcion: "Pantalla", marca: "Samsung", modelo: "A10", categoriaId: "c1", precioVenta: 90000, imagenUrl: null, existenciaAqui: 2, reservadoAqui: 1 },
    { id: "r2", codigo: "R-2", descripcion: "Batería", marca: "Motorola", modelo: "G8", categoriaId: null, precioVenta: 50000, imagenUrl: null, existenciaAqui: 0, reservadoAqui: 0 },
  ],
  articulos: [
    { id: "a1", numero: 7, codigo: "A7", tipo: "Celular", marca: "Xiaomi", modelo: "Note 9", numero_serie: "XYZ", precio_venta: 400000, imagen_url: null, categoriaId: null },
  ],
  clientes: [
    { id: "k1", nombre: "José Pérez", documento: "123", telefono: "300", correo: null },
    { id: "k2", nombre: "Ana Gómez", documento: "456", telefono: "311", correo: "ana@x.co" },
  ],
  ordenesAbiertas: [orden("o1", 14, "José Pérez", "SN1"), orden("o2", 20, "Ana Gómez", "SN2")],
  prefijoEtiqueta: "PS",
  categorias: [{ id: "c1", nombre: "Pantallas" }],
  metodosPago: [],
  turno: null,
};

describe("consultas del admin sin internet", () => {
  it("órdenes: la más nueva primero, y se buscan por cliente sin tildes, serial, número o código de etiqueta", () => {
    expect(ordenesLocal(copia, "").map((o) => o.numero)).toEqual([20, 14]);
    expect(ordenesLocal(copia, "jose").map((o) => o.id)).toEqual(["o1"]);
    expect(ordenesLocal(copia, "sn2").map((o) => o.id)).toEqual(["o2"]);
    expect(ordenesLocal(copia, "PS000014").map((o) => o.id)).toEqual(["o1"]);
    expect(ordenesLocal(copia, "nokia")).toEqual([]);
  });

  it("existencias: repuestos y artículos, por código, nombre, marca o categoría", () => {
    expect(existenciasLocal(copia, "").map((f) => f.id)).toEqual(["r2", "a1", "r1"]);
    expect(existenciasLocal(copia, "pantallas").map((f) => f.id)).toEqual(["r1"]);
    expect(existenciasLocal(copia, "xyz")[0]).toMatchObject({ clase: "articulo", id: "a1" });
    expect(existenciasLocal(copia, "bateria")[0]).toMatchObject({ clase: "repuesto", disponible: 0 });
  });

  it("clientes: por nombre, documento, teléfono o correo", () => {
    expect(clientesLocal(copia, "").map((c) => c.id)).toEqual(["k2", "k1"]);
    expect(clientesLocal(copia, "perez").map((c) => c.id)).toEqual(["k1"]);
    expect(clientesLocal(copia, "ana@x").map((c) => c.id)).toEqual(["k2"]);
  });

  it("solo tablero, inventario y clientes tienen consulta sin internet", () => {
    expect(consultaDeRuta("/ordenes")).toBe("ordenes");
    expect(consultaDeRuta("/inventario")).toBe("existencias");
    expect(consultaDeRuta("/clientes")).toBe("clientes");
    expect(consultaDeRuta("/configuracion")).toBeNull();
    expect(consultaDeRuta("/ordenes/x/editar")).toBeNull();
  });
});
