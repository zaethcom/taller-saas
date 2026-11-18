import { describe, expect, it } from "vitest";
import {
  TIPOS_EQUIPO_POR_DEFECTO,
  etiquetaTipoEquipo,
  normalizarTiposEquipo,
  opcionesTipoEquipo,
  tipoEquipoInicial,
  tiposEquipoDeEmpresa,
  valorDeEtiqueta,
} from "../lib/tipos-equipo";

describe("tipos de equipo editables", () => {
  it("sin lista guardada usa los de siempre", () => {
    expect(tiposEquipoDeEmpresa(null)).toEqual(TIPOS_EQUIPO_POR_DEFECTO);
    expect(tiposEquipoDeEmpresa([])).toEqual(TIPOS_EQUIPO_POR_DEFECTO);
  });

  it("renombrar conserva el valor (celular sigue pidiendo teléfono alterno)", () => {
    expect(normalizarTiposEquipo([{ valor: "celular", etiqueta: "  Celulares  y tablets " }])).toEqual([
      { valor: "celular", etiqueta: "Celulares y tablets" },
    ]);
  });

  it("a los nuevos les pone un valor sin tildes y sin chocar", () => {
    expect(valorDeEtiqueta("Cámara / Dron")).toBe("camara-dron");
    expect(
      normalizarTiposEquipo([
        { valor: "consola", etiqueta: "Consola" },
        { etiqueta: "Consola " },
        { etiqueta: "Consolá" },
        { etiqueta: "" },
        "basura",
      ]),
    ).toEqual([
      { valor: "consola", etiqueta: "Consola" },
      { valor: "consola-2", etiqueta: "Consolá" },
    ]);
  });

  it("una lista vacía no vale", () => {
    expect(normalizarTiposEquipo([{ etiqueta: " " }])).toBeNull();
    expect(normalizarTiposEquipo("x")).toBeNull();
  });

  it("un equipo con un tipo quitado lo sigue mostrando", () => {
    const lista = [{ valor: "celular", etiqueta: "Celular" }];
    expect(opcionesTipoEquipo(lista, "patineta")).toEqual([{ valor: "patineta", etiqueta: "Patineta" }, ...lista]);
    expect(opcionesTipoEquipo(lista, "celular")).toBe(lista);
    expect(etiquetaTipoEquipo("dron", lista)).toBe("Dron");
  });

  it("propone el tipo del negocio si sigue en la lista, si no el primero", () => {
    const lista = [{ valor: "tablet", etiqueta: "Tablet" }, { valor: "celular", etiqueta: "Celular" }];
    expect(tipoEquipoInicial(lista, "celular")).toBe("celular");
    expect(tipoEquipoInicial(lista, "patineta")).toBe("tablet");
  });
});
