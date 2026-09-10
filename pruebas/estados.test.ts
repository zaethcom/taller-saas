import { describe, expect, it } from "vitest";
import {
  ESTADOS_FINALES,
  REQUISITOS,
  RequisitoFaltanteError,
  TRANSICIONES,
  TransicionInvalidaError,
  esFinal,
  puedeTransicionar,
  siguientesEstados,
  transicionar,
  type Estado,
  type Requisito,
} from "../lib/estados";

const TODOS_LOS_ESTADOS = Object.keys(TRANSICIONES) as Estado[];

describe("el grafo de transiciones", () => {
  it("solo permite las cinco transiciones felices descritas en el plano", () => {
    expect(puedeTransicionar("recibida", "en_diagnostico")).toBe(true);
    expect(puedeTransicionar("en_diagnostico", "esperando_aprobacion")).toBe(true);
    expect(puedeTransicionar("esperando_aprobacion", "en_reparacion")).toBe(true);
    expect(puedeTransicionar("en_reparacion", "entregada")).toBe(true);
  });

  it("permite el rechazo del cliente y su entrega sin reparar", () => {
    expect(puedeTransicionar("esperando_aprobacion", "rechazada")).toBe(true);
    expect(puedeTransicionar("rechazada", "entregada")).toBe(true);
  });

  it("permite la espera de repuesto y el regreso a reparación", () => {
    expect(puedeTransicionar("en_reparacion", "esperando_repuesto")).toBe(true);
    expect(puedeTransicionar("esperando_repuesto", "en_reparacion")).toBe(true);
  });

  it("rechaza cualquier salto que no esté dibujado en el diagrama", () => {
    expect(puedeTransicionar("recibida", "entregada")).toBe(false);
    expect(puedeTransicionar("recibida", "en_reparacion")).toBe(false);
    expect(puedeTransicionar("entregada", "recibida")).toBe(false);
    expect(puedeTransicionar("rechazada", "en_reparacion")).toBe(false);
  });

  it("no permite retroceder de esperando_aprobacion a en_diagnostico", () => {
    // Es una trampa fácil: alguien podría querer "corregir" el diagnóstico
    // devolviendo la orden. La regla del negocio es que no se retrocede;
    // se abre una nueva cotización sobre la misma orden.
    expect(puedeTransicionar("esperando_aprobacion", "en_diagnostico")).toBe(false);
  });

  it("entregada no tiene salidas: es un estado final real", () => {
    expect(siguientesEstados("entregada")).toEqual([]);
    expect(esFinal("entregada")).toBe(true);
  });

  it("ningún estado no-final queda sin salida (nadie se puede quedar atascado)", () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      if (ESTADOS_FINALES.includes(estado)) continue;
      expect(
        siguientesEstados(estado).length,
        `"${estado}" no tiene ninguna transición de salida`,
      ).toBeGreaterThan(0);
    }
  });

  it("todo estado que REQUISITOS menciona existe en TRANSICIONES", () => {
    for (const estado of Object.keys(REQUISITOS) as Estado[]) {
      expect(TODOS_LOS_ESTADOS).toContain(estado);
    }
  });
});

describe("transicionar() — la puerta única de cambio de estado", () => {
  it("lanza TransicionInvalidaError si el salto no existe en el grafo", () => {
    expect(() => transicionar("recibida", "entregada", new Set())).toThrow(
      TransicionInvalidaError,
    );
  });

  it("lanza RequisitoFaltanteError si faltan requisitos aunque el salto exista", () => {
    expect(() =>
      transicionar("recibida", "en_diagnostico", new Set<Requisito>()),
    ).toThrow(RequisitoFaltanteError);
  });

  it("el error de requisito faltante lista exactamente lo que falta", () => {
    try {
      transicionar(
        "recibida",
        "en_diagnostico",
        new Set<Requisito>(["tiene_foto_entrada"]),
      );
      expect.unreachable("debía lanzar RequisitoFaltanteError");
    } catch (e) {
      expect(e).toBeInstanceOf(RequisitoFaltanteError);
      const err = e as RequisitoFaltanteError;
      expect(err.faltantes).toEqual(["tiene_etiqueta", "tiene_tecnico"]);
    }
  });

  it("no lanza cuando el salto existe y todos los requisitos están cumplidos", () => {
    expect(() =>
      transicionar(
        "recibida",
        "en_diagnostico",
        new Set<Requisito>(["tiene_foto_entrada", "tiene_etiqueta", "tiene_tecnico"]),
      ),
    ).not.toThrow();
  });

  it("recibida -> en_diagnostico exige foto, etiqueta y técnico asignado", () => {
    expect(REQUISITOS.en_diagnostico).toEqual([
      "tiene_foto_entrada",
      "tiene_etiqueta",
      "tiene_tecnico",
    ]);
  });

  it("no se entrega una orden sin saldo en cero, aunque tenga foto y firma", () => {
    // Esta es la regla que nació de meter el POS en el taller: no se
    // entrega un equipo con anticipo pendiente por cobrar.
    expect(() =>
      transicionar(
        "en_reparacion",
        "entregada",
        new Set<Requisito>(["tiene_foto_salida", "tiene_firma"]),
      ),
    ).toThrow(RequisitoFaltanteError);
  });

  it("entregar exige foto de salida, firma y saldo en cero, las tres juntas", () => {
    expect(REQUISITOS.entregada).toEqual([
      "tiene_foto_salida",
      "tiene_firma",
      "saldo_en_cero",
    ]);
  });

  it("una transición sin requisitos declarados no exige nada", () => {
    // esperando_aprobacion -> en_reparacion pasa por la aprobación del
    // cliente vía enlace, pero requiere cotizacion_aprobada explícitamente.
    // en_reparacion -> esperando_repuesto no tiene entrada en REQUISITOS:
    // marcar un faltante no debe bloquearse por nada más.
    expect(() =>
      transicionar("en_reparacion", "esperando_repuesto", new Set()),
    ).not.toThrow();
  });
});

describe("un escenario completo, de principio a fin", () => {
  it("sigue el camino feliz respetando cada requisito en su turno", () => {
    const cumplidos = new Set<Requisito>();

    // Recepción: llega la foto, la etiqueta y se asigna técnico.
    cumplidos.add("tiene_foto_entrada").add("tiene_etiqueta").add("tiene_tecnico");
    expect(() => transicionar("recibida", "en_diagnostico", cumplidos)).not.toThrow();

    // El técnico arma la cotización.
    cumplidos.add("tiene_cotizacion");
    expect(() =>
      transicionar("en_diagnostico", "esperando_aprobacion", cumplidos),
    ).not.toThrow();

    // Sin aprobación todavía, no puede pasar a reparación.
    expect(() => transicionar("esperando_aprobacion", "en_reparacion", cumplidos)).toThrow(
      RequisitoFaltanteError,
    );

    // El cliente aprueba desde el enlace.
    cumplidos.add("cotizacion_aprobada");
    expect(() =>
      transicionar("esperando_aprobacion", "en_reparacion", cumplidos),
    ).not.toThrow();

    // Falta un repuesto a mitad de la reparación.
    expect(() =>
      transicionar("en_reparacion", "esperando_repuesto", cumplidos),
    ).not.toThrow();
    expect(() =>
      transicionar("esperando_repuesto", "en_reparacion", cumplidos),
    ).not.toThrow();

    // Sin foto de salida ni firma ni saldo en cero, no se entrega.
    expect(() => transicionar("en_reparacion", "entregada", cumplidos)).toThrow(
      RequisitoFaltanteError,
    );

    cumplidos.add("tiene_foto_salida").add("tiene_firma").add("saldo_en_cero");
    expect(() => transicionar("en_reparacion", "entregada", cumplidos)).not.toThrow();
  });
});
