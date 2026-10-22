import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL,
  ESTADOS_FINALES,
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_CLIENTE,
  REQUISITOS,
  RequisitoFaltanteError,
  TRANSICIONES,
  TransicionInvalidaError,
  comprasAutorizadas,
  esEstado,
  esFinal,
  estadoSegunRepuestos,
  etiquetaEstado,
  itemsSeQuitan,
  puedeTransicionar,
  siguientesEstados,
  transicionar,
  type Estado,
  type Requisito,
} from "../lib/estados";

const TODOS_LOS_ESTADOS = Object.keys(TRANSICIONES) as Estado[];
const PARA_ENTREGAR = new Set<Requisito>(["tiene_foto_salida", "tiene_firma", "saldo_en_cero"]);

describe("los estados simples (0065)", () => {
  it("son cuatro mientras el equipo está en el taller, más entregada", () => {
    expect(TODOS_LOS_ESTADOS).toEqual(["en_proceso", "falta_repuesto", "esperando_cliente", "listo_entrega", "entregada"]);
  });

  it("toda orden nace en proceso", () => {
    expect(ESTADO_INICIAL).toBe("en_proceso");
  });

  it("cada estado tiene nombre para el taller y para el cliente", () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      expect(ETIQUETA_ESTADO[estado]).toBeTruthy();
      expect(ETIQUETA_ESTADO_CLIENTE[estado]).toBeTruthy();
    }
    expect(ETIQUETA_ESTADO_CLIENTE.esperando_cliente).toBe("Esperando tu aprobación");
  });

  it("los estados de antes se siguen leyendo en el historial", () => {
    expect(esEstado("recibida")).toBe(false);
    expect(etiquetaEstado("recibida")).toBe("Recibida");
    expect(etiquetaEstado("rechazada")).toBe("Pendiente de decisión");
    expect(etiquetaEstado("en_proceso")).toBe("En proceso");
    expect(etiquetaEstado("raro")).toBe("raro");
  });
});

describe("el grafo de transiciones", () => {
  it("el técnico marca terminado o falta repuesto desde en proceso", () => {
    expect(puedeTransicionar("en_proceso", "listo_entrega")).toBe(true);
    expect(puedeTransicionar("en_proceso", "falta_repuesto")).toBe(true);
    expect(puedeTransicionar("falta_repuesto", "en_proceso")).toBe(true);
  });

  it("cotizar pone la orden a esperar al cliente, también si falta repuesto", () => {
    expect(puedeTransicionar("en_proceso", "esperando_cliente")).toBe(true);
    expect(puedeTransicionar("falta_repuesto", "esperando_cliente")).toBe(true);
  });

  it("terminado vuelve a en proceso si algo no quedó bien", () => {
    expect(puedeTransicionar("listo_entrega", "en_proceso")).toBe(true);
    expect(puedeTransicionar("listo_entrega", "falta_repuesto")).toBe(false);
    expect(puedeTransicionar("falta_repuesto", "listo_entrega")).toBe(false);
  });

  it("permite entregar desde cualquier estado no final (los requisitos siguen aplicando)", () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      if (ESTADOS_FINALES.includes(estado)) continue;
      expect(puedeTransicionar(estado, "entregada"), `"${estado}" no puede entregarse`).toBe(true);
    }
  });

  it("entregada no tiene salidas: es un estado final real", () => {
    expect(siguientesEstados("entregada")).toEqual([]);
    expect(esFinal("entregada")).toBe(true);
  });

  it("ningún estado no-final queda sin salida (nadie se puede quedar atascado)", () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      if (ESTADOS_FINALES.includes(estado)) continue;
      expect(siguientesEstados(estado).length, `"${estado}" no tiene salida`).toBeGreaterThan(0);
    }
  });

  it("un estado viejo no tiene transiciones", () => {
    expect(puedeTransicionar("recibida" as Estado, "en_proceso")).toBe(false);
  });
});

describe("transicionar() — la puerta única de cambio de estado", () => {
  it("lanza TransicionInvalidaError si el salto no existe en el grafo", () => {
    expect(() => transicionar("listo_entrega", "esperando_cliente", new Set())).toThrow(TransicionInvalidaError);
  });

  it("terminado y falta repuesto no exigen nada", () => {
    expect(() => transicionar("en_proceso", "listo_entrega", new Set())).not.toThrow();
    expect(() => transicionar("en_proceso", "falta_repuesto", new Set())).not.toThrow();
  });

  it("esperar al cliente exige una cotización", () => {
    expect(() => transicionar("en_proceso", "esperando_cliente", new Set())).toThrow(RequisitoFaltanteError);
    expect(() =>
      transicionar("en_proceso", "esperando_cliente", new Set<Requisito>(["tiene_cotizacion"])),
    ).not.toThrow();
  });

  it("de esperar al cliente solo se sigue con su aprobación", () => {
    try {
      transicionar("esperando_cliente", "en_proceso", new Set<Requisito>(["tiene_cotizacion"]));
      expect.unreachable("debía lanzar RequisitoFaltanteError");
    } catch (e) {
      expect(e).toBeInstanceOf(RequisitoFaltanteError);
      expect((e as RequisitoFaltanteError).faltantes).toEqual(["cotizacion_aprobada"]);
    }
    expect(() =>
      transicionar("esperando_cliente", "falta_repuesto", new Set<Requisito>(["cotizacion_aprobada"])),
    ).not.toThrow();
  });

  it("entregar sin reparar no pide aprobación, pero sí lo de toda entrega", () => {
    expect(() => transicionar("esperando_cliente", "entregada", PARA_ENTREGAR)).not.toThrow();
    expect(() =>
      transicionar("en_proceso", "entregada", new Set<Requisito>(["tiene_foto_salida", "tiene_firma"])),
    ).toThrow(RequisitoFaltanteError);
  });

  it("entregar exige foto de salida, firma y saldo en cero, las tres juntas", () => {
    expect(REQUISITOS.entregada).toEqual(["tiene_foto_salida", "tiene_firma", "saldo_en_cero"]);
  });
});

describe("un escenario completo, con cotización", () => {
  it("en proceso → esperando al cliente → falta repuesto → en proceso → terminado → entregada", () => {
    const cumplidos = new Set<Requisito>(["tiene_cotizacion"]);
    expect(() => transicionar("en_proceso", "esperando_cliente", cumplidos)).not.toThrow();
    cumplidos.add("cotizacion_aprobada");
    expect(() => transicionar("esperando_cliente", estadoSegunRepuestos(1), cumplidos)).not.toThrow();
    expect(() => transicionar("falta_repuesto", "en_proceso", cumplidos)).not.toThrow();
    expect(() => transicionar("en_proceso", "listo_entrega", cumplidos)).not.toThrow();
    expect(() => transicionar("listo_entrega", "entregada", cumplidos)).toThrow(RequisitoFaltanteError);
    expect(() => transicionar("listo_entrega", "entregada", new Set([...cumplidos, ...PARA_ENTREGAR]))).not.toThrow();
  });
});

describe("estadoSegunRepuestos", () => {
  it("con repuestos pedidos sin llegar, falta repuesto", () => {
    expect(estadoSegunRepuestos(0)).toBe("en_proceso");
    expect(estadoSegunRepuestos(2)).toBe("falta_repuesto");
  });
});

describe("comprasAutorizadas", () => {
  it("se compra siempre, salvo mientras el cliente decide o ya se entregó", () => {
    expect(comprasAutorizadas("en_proceso")).toBe(true);
    expect(comprasAutorizadas("falta_repuesto")).toBe(true);
    expect(comprasAutorizadas("listo_entrega")).toBe(true);
    expect(comprasAutorizadas("esperando_cliente")).toBe(false);
    expect(comprasAutorizadas("entregada")).toBe(false);
  });
});

describe("itemsSeQuitan", () => {
  it("solo antes de enviar una cotización y sin entregar", () => {
    expect(itemsSeQuitan("en_proceso", false)).toBe(true);
    expect(itemsSeQuitan("falta_repuesto", false)).toBe(true);
    expect(itemsSeQuitan("en_proceso", true)).toBe(false);
    expect(itemsSeQuitan("entregada", false)).toBe(false);
  });
});
