import { describe, expect, it } from "vitest";
import { filasDeFases, type FaseOrden } from "../lib/fases";
import { lineas, limpiarNombres, validarTipo } from "../lib/tipos-empresa";

describe("limpiar nombres", () => {
  it("quita vacíos, espacios de más y repetidos sin importar mayúsculas", () => {
    expect(limpiarNombres([" Pantallas ", "", "pantallas", "Baterías  de  litio", 3])).toEqual([
      "Pantallas",
      "Baterías de litio",
    ]);
  });

  it("lee una por línea", () => {
    expect(lineas("Motor\n\n  Frenos \nmotor")).toEqual(["Motor", "Frenos"]);
  });
});

describe("validar un tipo", () => {
  it("exige nombre al crear", () => {
    expect(validarTipo({ nombre: "  " }, { parcial: false })).toEqual({ error: "falta el nombre del tipo" });
  });

  it("al editar acepta solo lo que vino", () => {
    expect(validarTipo({ activo: false }, { parcial: true })).toEqual({ campos: { activo: false } });
  });

  it("rechaza un estado que no existe y un tipo de equipo desconocido", () => {
    expect(validarTipo({ nombre: "X", fases: { volando: ["A"] } }, { parcial: false })).toEqual({
      error: "las fases no son válidas",
    });
    expect(validarTipo({ nombre: "X", tipo_equipo: "nevera" }, { parcial: false })).toEqual({
      error: "el tipo de equipo no es válido",
    });
  });

  it("limpia fases y categorías y descarta estados sin fases", () => {
    const r = validarTipo(
      {
        nombre: " Consolas ",
        tipo_equipo: "otro",
        fases: { en_reparacion: ["Limpieza", " limpieza", "Soldadura"], en_diagnostico: [""] },
        categorias: ["Controles", "controles"],
      },
      { parcial: false },
    );
    expect(r).toEqual({
      campos: {
        nombre: "Consolas",
        tipo_equipo: "otro",
        fases: { en_reparacion: ["Limpieza", "Soldadura"] },
        categorias: ["Controles"],
      },
    });
  });
});

describe("aplicar las fases de un tipo", () => {
  it("agrega al final y se salta las que la empresa ya tiene activas", () => {
    const existentes: FaseOrden[] = [{ id: "a", estado: "en_reparacion", nombre: "Motor", posicion: 3, activo: true }];
    expect(filasDeFases({ en_reparacion: ["motor", "Prueba de ruta"] }, existentes)).toEqual([
      { estado: "en_reparacion", nombre: "Prueba de ruta", posicion: 4 },
    ]);
  });
});
