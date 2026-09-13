import { describe, expect, it } from "vitest";
import {
  ESTADOS_ABIERTOS,
  ESTADOS_FINALES_SOLICITUD,
  TRANSICIONES_SOLICITUD,
  TransicionSolicitudInvalidaError,
  esFinalSolicitud,
  estaAbierta,
  puedeTransicionarSolicitud,
  transicionarSolicitud,
  type EstadoSolicitud,
} from "../lib/solicitudes";

const TODOS = Object.keys(TRANSICIONES_SOLICITUD) as EstadoSolicitud[];

describe("el grafo de una solicitud", () => {
  it("deja al almacén bifurcar entre despachar y no tener", () => {
    expect(puedeTransicionarSolicitud("pedido_a_sede", "en_traslado")).toBe(true);
    expect(puedeTransicionarSolicitud("pedido_a_sede", "faltante")).toBe(true);
  });

  it("conserva el camino que /compras ya usaba antes de esto", () => {
    // La ruta de recibir hacía faltante -> recibido directo. Romper eso
    // dejaría sin cerrar los faltantes que ya existen en la base.
    expect(puedeTransicionarSolicitud("faltante", "recibido")).toBe(true);
  });

  it("no deja saltarse el traslado para dar algo por recibido", () => {
    expect(puedeTransicionarSolicitud("pedido_a_sede", "recibido")).toBe(false);
  });

  it("no deja consumir lo que todavía no llegó", () => {
    expect(puedeTransicionarSolicitud("en_traslado", "consumido")).toBe(false);
    expect(puedeTransicionarSolicitud("faltante", "consumido")).toBe(false);
  });

  it("no deja volver atrás desde un traslado en camino", () => {
    // Si ya salió del almacén, la existencia ya se descontó allá: decir
    // "faltante" ahora perdería la pista de mercancía que está en tránsito.
    expect(puedeTransicionarSolicitud("en_traslado", "faltante")).toBe(false);
    expect(puedeTransicionarSolicitud("en_traslado", "pedido_a_sede")).toBe(false);
  });

  it("consumido es el único final, y no sale de ahí", () => {
    expect(ESTADOS_FINALES_SOLICITUD).toEqual(["consumido"]);
    expect(TRANSICIONES_SOLICITUD.consumido).toEqual([]);
    expect(esFinalSolicitud("consumido")).toBe(true);
    TODOS.filter((e) => e !== "consumido").forEach((e) => {
      expect(esFinalSolicitud(e)).toBe(false);
    });
  });

  it("todo estado alcanza consumido salvo el propio final", () => {
    // Un estado del que no se puede llegar al final es una fila que se
    // queda atascada para siempre en una bandeja.
    const alcanza = (desde: EstadoSolicitud, vistos = new Set<EstadoSolicitud>()): boolean => {
      if (desde === "consumido") return true;
      if (vistos.has(desde)) return false;
      vistos.add(desde);
      return TRANSICIONES_SOLICITUD[desde].some((s) => alcanza(s, vistos));
    };
    TODOS.forEach((e) => expect(alcanza(e)).toBe(true));
  });

  it("ningún estado se declara transición hacia sí mismo", () => {
    TODOS.forEach((e) => expect(TRANSICIONES_SOLICITUD[e]).not.toContain(e));
  });
});

describe("transicionarSolicitud", () => {
  it("devuelve el estado nuevo cuando la transición existe", () => {
    expect(transicionarSolicitud("pedido_a_sede", "en_traslado")).toBe("en_traslado");
  });

  it("lanza, y dice cuál era la transición imposible", () => {
    expect(() => transicionarSolicitud("consumido", "recibido")).toThrow(
      TransicionSolicitudInvalidaError,
    );
    expect(() => transicionarSolicitud("consumido", "recibido")).toThrow(
      "una solicitud en 'consumido' no puede pasar a 'recibido'",
    );
  });
});

describe("las bandejas", () => {
  it("consideran abierto todo lo que espera algo de alguien", () => {
    expect(estaAbierta("pedido_a_sede")).toBe(true);
    expect(estaAbierta("en_traslado")).toBe(true);
    expect(estaAbierta("faltante")).toBe(true);
    expect(estaAbierta("solicitado")).toBe(true);
  });

  it("no listan lo que ya llegó ni lo que ya se usó", () => {
    expect(estaAbierta("recibido")).toBe(false);
    expect(estaAbierta("consumido")).toBe(false);
  });

  it("cubren todos los estados entre abiertos y cerrados, sin olvidar ninguno", () => {
    const cerrados: EstadoSolicitud[] = ["recibido", "consumido"];
    expect([...ESTADOS_ABIERTOS, ...cerrados].sort()).toEqual([...TODOS].sort());
  });
});
