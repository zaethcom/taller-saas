import { describe, expect, it } from "vitest";
import {
  calcularCambios,
  esEventoEdicion,
  normalizarDatos,
  notaEdicion,
  validarDatos,
  type DatosEdicion,
} from "../lib/orden-edicion";

const base: DatosEdicion = {
  cliente: { nombre: "Ana Pérez", documento: "123", telefono: "3001234567", correo: "" },
  equipo: { serial: "ABC1", tipo: "celular", marca: "Samsung", modelo: "A10" },
  orden: { motivo: "Pantalla rota", infoAdicional: "", telefonoAlterno: "" },
  valorServicio: 80000,
};

describe("normalizarDatos", () => {
  it("recorta espacios y redondea el valor", () => {
    const d = normalizarDatos({
      ...base,
      cliente: { ...base.cliente, nombre: "  Ana   Pérez " },
      orden: { ...base.orden, motivo: " Pantalla\nrota " },
      valorServicio: 80000.4,
    });
    expect(d.cliente.nombre).toBe("Ana Pérez");
    expect(d.orden.motivo).toBe("Pantalla\nrota");
    expect(d.valorServicio).toBe(80000);
  });

  it("deja el valor en null cuando no se puede editar", () => {
    expect(normalizarDatos({ ...base, valorServicio: null }).valorServicio).toBeNull();
  });
});

describe("validarDatos", () => {
  it("pide nombre, serial, tipo y motivo", () => {
    const vacio = normalizarDatos({
      cliente: { nombre: "", documento: "", telefono: "", correo: "" },
      equipo: { serial: "", tipo: "", marca: "", modelo: "" },
      orden: { motivo: "", infoAdicional: "", telefonoAlterno: "" },
      valorServicio: null,
    });
    expect(validarDatos(vacio)).toHaveLength(4);
    expect(validarDatos(base)).toEqual([]);
  });

  it("rechaza un correo mal escrito", () => {
    expect(validarDatos({ ...base, cliente: { ...base.cliente, correo: "ana@" } })).toEqual(["El correo no parece válido"]);
  });
});

describe("calcularCambios", () => {
  it("sin cambios no devuelve nada", () => {
    expect(calcularCambios(base, base).lista).toEqual([]);
  });

  it("separa lo del cliente, el equipo y la orden", () => {
    const despues = {
      ...base,
      cliente: { ...base.cliente, telefono: "3109999999" },
      equipo: { ...base.equipo, modelo: "A20" },
      orden: { ...base.orden, telefonoAlterno: "3205555555" },
      valorServicio: 90000,
    };
    const c = calcularCambios(base, despues);
    expect(c.cliente).toEqual({ telefono: "3109999999" });
    expect(c.equipo).toEqual({ modelo: "A20" });
    expect(c.orden).toEqual({ telefonoAlterno: "3205555555" });
    expect(c.valorServicio).toBe(90000);
    expect(c.lista.map((x) => x.campo)).toEqual(["teléfono", "modelo", "número alternativo", "valor del servicio"]);
  });

  it("no toca el valor si no es editable", () => {
    const c = calcularCambios({ ...base, valorServicio: null }, { ...base, valorServicio: null });
    expect(c.valorServicio).toBeNull();
  });
});

describe("historial", () => {
  it("anota quién cambió qué y se reconoce como corrección", () => {
    const nota = notaEdicion([{ campo: "teléfono", antes: "300", despues: "" }], "Frank");
    expect(nota).toBe("Datos corregidos por Frank. teléfono: 300 → (vacío)");
    expect(esEventoEdicion({ de_estado: "recibida", a_estado: "recibida", nota })).toBe(true);
    expect(esEventoEdicion({ de_estado: "recibida", a_estado: "en_diagnostico", nota })).toBe(false);
    expect(esEventoEdicion({ de_estado: "recibida", a_estado: "recibida", nota: "Antes: x" })).toBe(false);
  });
});
