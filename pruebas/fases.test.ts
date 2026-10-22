import { describe, expect, it } from "vitest";
import { etiquetaEvento } from "../lib/fases";

describe("historial", () => {
  it("un cambio de estado nuevo se lee con su nombre", () => {
    expect(etiquetaEvento({ de_estado: "en_proceso", a_estado: "falta_repuesto", a_fase: null })).toBe("Falta repuesto");
  });

  it("los eventos de antes de 0065 se leen con los nombres de entonces y su fase", () => {
    expect(etiquetaEvento({ de_estado: "esperando_aprobacion", a_estado: "en_reparacion", a_fase: "Motor" })).toBe(
      "En reparación · Motor",
    );
    expect(etiquetaEvento({ de_estado: "recibida", a_estado: "en_diagnostico", a_fase: null })).toBe("En diagnóstico");
    expect(etiquetaEvento({ de_estado: "en_reparacion", a_estado: "en_reparacion", a_fase: "Software" })).toBe(
      "En reparación · Software",
    );
  });

  it("un estado desconocido se muestra tal cual", () => {
    expect(etiquetaEvento({ de_estado: null, a_estado: "otro", a_fase: null })).toBe("otro");
  });
});
