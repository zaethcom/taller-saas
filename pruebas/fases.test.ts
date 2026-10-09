import { describe, expect, it } from "vitest";
import { TRANSICIONES, type Estado } from "../lib/estados";
import {
  PLANTILLAS,
  esEstado,
  esPlantilla,
  etiquetaEvento,
  faseValidaPara,
  fasesActivasDe,
  filasDePlantilla,
  moverFase,
  primeraFaseActiva,
  siguientePosicion,
  type FaseOrden,
} from "../lib/fases";

function fase(id: string, estado: Estado, nombre: string, posicion: number, activo = true): FaseOrden {
  return { id, estado, nombre, posicion, activo };
}

const [SOFTWARE, MICROSOLDADURA, DESARME_VIEJO, DESARME] = [
  fase("a", "en_reparacion", "Software", 2),
  fase("b", "en_reparacion", "Microsoldadura", 1),
  fase("c", "en_reparacion", "Desarme viejo", 0, false),
  fase("d", "en_diagnostico", "Desarme", 0),
] as const;
const FASES: FaseOrden[] = [SOFTWARE, MICROSOLDADURA, DESARME_VIEJO, DESARME];

describe("primera fase de un estado", () => {
  it("es la activa de menor posición, saltándose las inactivas", () => {
    expect(primeraFaseActiva(FASES, "en_reparacion")?.id).toBe("b");
  });

  it("es null si el estado no tiene fases activas", () => {
    expect(primeraFaseActiva(FASES, "recibida")).toBeNull();
    expect(primeraFaseActiva([fase("x", "recibida", "X", 0, false)], "recibida")).toBeNull();
  });

  it("fasesActivasDe devuelve solo las activas del estado, en orden", () => {
    expect(fasesActivasDe(FASES, "en_reparacion").map((f) => f.id)).toEqual(["b", "a"]);
  });
});

describe("validar una fase para el estado de la orden", () => {
  it("acepta una fase activa del mismo estado", () => {
    expect(faseValidaPara(SOFTWARE, "en_reparacion")).toBe(true);
  });

  it("rechaza una fase de otro estado", () => {
    expect(faseValidaPara(DESARME, "en_reparacion")).toBe(false);
  });

  it("rechaza una fase inactiva aunque sea del mismo estado", () => {
    expect(faseValidaPara(DESARME_VIEJO, "en_reparacion")).toBe(false);
  });
});

describe("plantillas", () => {
  it("solo usan estados que existen en la máquina de estados", () => {
    for (const p of Object.values(PLANTILLAS)) {
      for (const estado of Object.keys(p.fases)) {
        expect(estado in TRANSICIONES).toBe(true);
      }
    }
  });

  it("en una empresa sin fases, se cargan completas desde la posición 0", () => {
    const filas = filasDePlantilla("celulares", []);
    expect(filas.filter((f) => f.estado === "en_reparacion").map((f) => f.nombre)).toEqual(
      PLANTILLAS.celulares.fases.en_reparacion,
    );
    expect(filas.filter((f) => f.estado === "en_diagnostico").map((f) => f.posicion)).toEqual([0, 1]);
  });

  it("se agregan después de las existentes y no duplican un nombre activo", () => {
    const filas = filasDePlantilla("celulares", FASES);
    const reparacion = filas.filter((f) => f.estado === "en_reparacion");
    expect(reparacion.map((f) => f.nombre)).not.toContain("Software");
    expect(reparacion.map((f) => f.nombre)).not.toContain("Microsoldadura");
    expect(reparacion[0]?.posicion).toBe(3);
    // "Desarme" ya existe activo en diagnóstico (comparación sin mayúsculas ni espacios).
    expect(filasDePlantilla("celulares", [fase("d", "en_diagnostico", " desarme ", 0)]).map((f) => f.nombre)).not.toContain(
      "Desarme",
    );
  });

  it("un nombre que existe solo inactivo sí se vuelve a agregar", () => {
    const filas = filasDePlantilla("patinetas", [fase("m", "en_reparacion", "Motor", 0, false)]);
    expect(filas.some((f) => f.estado === "en_reparacion" && f.nombre === "Motor")).toBe(true);
  });

  it("cargar la misma plantilla dos veces no agrega nada la segunda", () => {
    const primera = filasDePlantilla("patinetas", []).map((f, i) => fase(String(i), f.estado, f.nombre, f.posicion));
    expect(filasDePlantilla("patinetas", primera)).toEqual([]);
  });

  it("esPlantilla y esEstado validan lo que llega por la API", () => {
    expect(esPlantilla("celulares")).toBe(true);
    expect(esPlantilla("computadores")).toBe(false);
    expect(esEstado("en_reparacion")).toBe(true);
    expect(esEstado("control_calidad")).toBe(false);
    expect(esEstado(undefined)).toBe(false);
  });
});

describe("posiciones", () => {
  it("siguientePosicion va después de la mayor del estado", () => {
    expect(siguientePosicion(FASES, "en_reparacion")).toBe(3);
    expect(siguientePosicion(FASES, "recibida")).toBe(0);
  });

  it("mover arriba intercambia con la anterior y devuelve solo lo que cambió", () => {
    expect(moverFase(FASES, "a", "arriba")).toEqual([
      { id: "a", posicion: 1 },
      { id: "b", posicion: 2 },
    ]);
  });

  it("no mueve más allá de los extremos", () => {
    expect(moverFase(FASES, "a", "abajo")).toEqual([]);
    expect(moverFase(FASES, "c", "arriba")).toEqual([]);
    expect(moverFase(FASES, "no-existe", "arriba")).toEqual([]);
  });

  it("separa dos fases con la misma posición renumerando el estado", () => {
    const empatadas = [fase("x", "recibida", "X", 0), fase("y", "recibida", "Y", 0)];
    const cambios = moverFase(empatadas, "y", "arriba");
    expect(cambios).toContainEqual({ id: "x", posicion: 1 });
  });
});

describe("historial", () => {
  it("un cambio de estado se lee con la fase con que arrancó", () => {
    expect(etiquetaEvento({ de_estado: "esperando_aprobacion", a_estado: "en_reparacion", a_fase: "Motor" })).toBe(
      "En reparación · Motor",
    );
    expect(etiquetaEvento({ de_estado: "recibida", a_estado: "en_diagnostico", a_fase: null })).toBe("En diagnóstico");
  });

  it("un cambio de fase dentro del mismo estado se nota aunque quede sin fase", () => {
    expect(etiquetaEvento({ de_estado: "en_reparacion", a_estado: "en_reparacion", a_fase: "Software" })).toBe(
      "En reparación · Software",
    );
    expect(etiquetaEvento({ de_estado: "en_reparacion", a_estado: "en_reparacion", a_fase: null })).toBe(
      "En reparación · sin fase",
    );
  });
});
