import { describe, expect, it } from "vitest";
import {
  aplicarAbonoEnCopia,
  aplicarEntregaEnCopia,
  buscarOrdenLocal,
  descripcionAbono,
  descripcionEntrega,
} from "../lib/sin-conexion/orden-local";
import { ErrorDesdeCopia, respuestaDesdeCopia } from "../lib/sin-conexion/leer-api";
import { esSubidaSinConexion } from "../lib/sin-conexion/clave-local";
import type { CopiaLocal, OrdenLocal } from "../lib/sin-conexion/tipos";

function orden(p: Partial<OrdenLocal> & { id: string; numero: number }): OrdenLocal {
  return {
    estado: "en_proceso",
    abiertaEn: "2026-11-18T10:00:00.000Z",
    total: 80000,
    telefonoAlterno: null,
    clienteId: "k1",
    serial: "SN1",
    tipo: "Celular",
    marca: "Samsung",
    modelo: "A10",
    cuenta: {
      motivo: "No carga",
      tokenPublico: `tok-${p.id}`,
      clienteNombre: "Ana",
      clienteTelefono: "300",
      valor: 80000,
      pagado: 20000,
      saldo: 60000,
      pagos: [{ numero: 41, tipo: "anticipo", monto: 20000, medio: "Efectivo", fecha: "2026-11-18T10:00:00.000Z" }],
      items: [{ descripcion: "Pin de carga", cantidad: 1, precioUnit: 80000, repuestoId: "r1" }],
    },
    ...p,
  };
}

const copia: CopiaLocal = {
  version: 1,
  generadaEn: "2026-11-18T20:00:00.000Z",
  empresaId: "e1",
  sedeId: "s1",
  usuarioId: "u1",
  repuestos: [],
  articulos: [],
  clientes: [],
  ordenesAbiertas: [orden({ id: "o1", numero: 14 }), orden({ id: "o2", numero: 15, cuenta: undefined })],
  prefijoEtiqueta: "PS",
  categorias: [],
  metodosPago: [],
  turno: null,
};

describe("buscarOrdenLocal", () => {
  it("encuentra por número, por código de entrada y por token del QR", () => {
    expect(buscarOrdenLocal(copia, { numero: "14" })?.id).toBe("o1");
    expect(buscarOrdenLocal(copia, { numero: " ps000014 " })?.id).toBe("o1");
    expect(buscarOrdenLocal(copia, { token: "tok-o1" })?.id).toBe("o1");
  });

  it("devuelve la misma forma que /api/ordenes/buscar", () => {
    const o = buscarOrdenLocal(copia, { numero: "14" })!;
    expect(o).toMatchObject({
      numero: 14,
      token_publico: "tok-o1",
      motivo: "No carga",
      valor: 80000,
      pagado: 20000,
      saldoPendiente: 60000,
      producto: { marca: "Samsung", serial: "SN1", cliente: { nombre: "Ana", telefono: "300" } },
    });
    expect(o.items).toHaveLength(1);
  });

  it("no encuentra órdenes que no están o que vienen de una copia sin cuenta", () => {
    expect(buscarOrdenLocal(copia, { numero: "99" })).toBeNull();
    expect(buscarOrdenLocal(copia, { numero: "OR000014" })).toBeNull();
    expect(buscarOrdenLocal(copia, { numero: "15" })).toBeNull();
  });
});

describe("aplicarAbonoEnCopia / aplicarEntregaEnCopia", () => {
  it("el abono suma a lo pagado, baja el saldo y no cambia la copia original", () => {
    const nueva = aplicarAbonoEnCopia(copia, "o1", { monto: 15000, medio: "Nequi", fecha: "2026-11-18T21:00:00.000Z" });
    const c = nueva.ordenesAbiertas[0]!.cuenta!;
    expect(c.pagado).toBe(35000);
    expect(c.saldo).toBe(45000);
    expect(c.pagos.at(-1)).toMatchObject({ numero: 0, tipo: "anticipo", monto: 15000, medio: "Nequi" });
    expect(copia.ordenesAbiertas[0]!.cuenta!.saldo).toBe(60000);
  });

  it("el saldo nunca queda negativo", () => {
    const nueva = aplicarAbonoEnCopia(copia, "o1", { monto: 90000, medio: null, fecha: "x" });
    expect(nueva.ordenesAbiertas[0]!.cuenta!.saldo).toBe(0);
  });

  it("la orden entregada sale de las abiertas", () => {
    expect(aplicarEntregaEnCopia(copia, "o1").ordenesAbiertas.map((o) => o.id)).toEqual(["o2"]);
    expect(copia.ordenesAbiertas).toHaveLength(2);
  });
});

describe("respuestaDesdeCopia para Cobrar y entregar", () => {
  it("responde la búsqueda de órdenes desde la copia", () => {
    expect((respuestaDesdeCopia(copia, "/api/ordenes/buscar?numero=14") as { id: string }).id).toBe("o1");
    expect((respuestaDesdeCopia(copia, "/api/ordenes/buscar?token=tok-o1") as { id: string }).id).toBe("o1");
  });

  it("una orden que no está en la copia es un 404 con mensaje, no un fallo de red", () => {
    const r = respuestaDesdeCopia(copia, "/api/ordenes/buscar?numero=99");
    expect(r).toBeInstanceOf(ErrorDesdeCopia);
    expect((r as ErrorDesdeCopia).status).toBe(404);
  });

  it("el perfil sale de la copia", () => {
    expect(respuestaDesdeCopia(copia, "/api/perfil")).toMatchObject({ empresaId: "e1", sedeId: "s1" });
  });
});

describe("esSubidaSinConexion", () => {
  const clave = "0b8f6c1e-2d3a-4c5b-8e9f-0a1b2c3d4e5f";
  it("solo lo que trae clave local y hora de la cola", () => {
    expect(esSubidaSinConexion({ claveLocal: clave, hechaEn: "2026-11-18T21:00:00.000Z" })).toBe(true);
    expect(esSubidaSinConexion({ claveLocal: clave })).toBe(false);
    expect(esSubidaSinConexion({ claveLocal: "x", hechaEn: "2026-11-18T21:00:00.000Z" })).toBe(false);
  });
});

describe("descripciones de la cola", () => {
  it("dicen qué orden y cuánto", () => {
    expect(descripcionAbono(14, 15000)).toMatch(/Abono orden #14 · \$15[.,]000/);
    expect(descripcionEntrega(14)).toBe("Entrega orden #14");
  });
});
