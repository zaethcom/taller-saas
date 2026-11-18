import { describe, expect, it } from "vitest";
import { libresSinUsados } from "../lib/sin-conexion/bloque-numeros";
import { numerosEnCola, type ElementoCola } from "../lib/sin-conexion/cola";
import { aplicarRecepcionEnCopia, buscarOrdenLocal, descripcionRecepcion } from "../lib/sin-conexion/orden-local";
import type { CopiaLocal } from "../lib/sin-conexion/tipos";

function elemento(p: Partial<ElementoCola> & { id: string }): ElementoCola {
  return {
    tipo: "recepcion",
    creadoEn: "2026-11-18T21:00:00.000Z",
    empresaId: "e1",
    sedeId: "s1",
    usuarioId: "u1",
    descripcion: "",
    url: "/api/ordenes",
    cuerpo: {},
    estado: "pendiente",
    intentos: 0,
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
  ordenesAbiertas: [],
  categorias: [],
  metodosPago: [],
  turno: null,
};

describe("libresSinUsados", () => {
  it("quita los números que ya se usaron en la cola, sin repetidos y en orden", () => {
    expect(libresSinUsados([7, 3, 4, 5, 4], [4])).toEqual([3, 5, 7]);
  });
  it("descarta lo que no es un número de orden válido", () => {
    expect(libresSinUsados([0, -1, 2.5, 6], [])).toEqual([6]);
  });
});

describe("numerosEnCola", () => {
  it("solo recepciones que el servidor todavía no tiene", () => {
    const cola = [
      elemento({ id: "a", cuerpo: { numero: 21 } }),
      elemento({ id: "b", cuerpo: { numero: 22 }, estado: "error" }),
      elemento({ id: "c", cuerpo: { numero: 23 }, estado: "aviso" }),
      elemento({ id: "d", tipo: "venta", cuerpo: { numero: 24 } }),
      elemento({ id: "e", cuerpo: {} }),
    ];
    expect(numerosEnCola(cola)).toEqual([21, 22]);
  });
});

describe("aplicarRecepcionEnCopia", () => {
  const nueva = aplicarRecepcionEnCopia(copia, {
    id: "o9",
    numero: 21,
    abiertaEn: "2026-11-18T21:00:00.000Z",
    motivo: "Pantalla rota",
    valorServicio: 120000,
    abono: 20000,
    medioAbono: "Efectivo",
    clienteId: null,
    clienteNombre: "Luis",
    clienteTelefono: "311",
    serial: null,
    tipo: "celular",
    marca: "Motorola",
    modelo: "G8",
    telefonoAlterno: "312",
  });

  it("la orden recibida sin conexión se puede abrir por número con su saldo", () => {
    const o = buscarOrdenLocal(nueva, { numero: "21" })!;
    expect(o).toMatchObject({ id: "o9", estado: "en_proceso", valor: 120000, pagado: 20000, saldoPendiente: 100000 });
    expect(o.items).toEqual([{ descripcion: "Pantalla rota", cantidad: 1, precioUnit: 120000, repuestoId: null }]);
    expect(copia.ordenesAbiertas).toHaveLength(0);
  });

  it("todavía no tiene QR: un token vacío no la encuentra", () => {
    expect(buscarOrdenLocal(nueva, { token: "" })).toBeNull();
  });

  it("describe la recepción para la lista de pendientes", () => {
    expect(descripcionRecepcion(21, "Luis")).toBe("Recepción orden #21 · Luis");
    expect(descripcionRecepcion(21, null)).toBe("Recepción orden #21");
  });
});
