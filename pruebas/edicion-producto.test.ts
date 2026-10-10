import { describe, expect, it } from "vitest";
import { cambiosArticulo, cambiosRepuesto } from "../lib/edicion-producto";

describe("cambiosRepuesto", () => {
  it("convierte los datos del formulario en columnas", () => {
    expect(
      cambiosRepuesto({
        codigo: " PAN-A10 ",
        descripcion: "Pantalla A10",
        precioVenta: "85000",
        costo: "",
        marca: "Samsung",
        modelo: "",
        categoriaId: "cat-1",
      }),
    ).toEqual({
      cambios: {
        codigo: "PAN-A10",
        descripcion: "Pantalla A10",
        precio_venta: 85000,
        costo: null,
        marca: "Samsung",
        modelo: null,
        categoria_id: "cat-1",
      },
    });
  });

  it("sigue aceptando solo la foto o solo en venta", () => {
    expect(cambiosRepuesto({ enVenta: false })).toEqual({ cambios: { en_venta: false } });
    expect(cambiosRepuesto({ imagenUrl: "x.jpg" })).toEqual({ cambios: { imagen_url: "x.jpg" } });
  });

  it("no deja vaciar código ni descripción", () => {
    expect(cambiosRepuesto({ codigo: "  " })).toHaveProperty("error");
    expect(cambiosRepuesto({ descripcion: "" })).toHaveProperty("error");
  });

  it("rechaza códigos que no caben en un código de barras", () => {
    expect(cambiosRepuesto({ codigo: "PANTALLA A10" })).toHaveProperty("error");
    expect(cambiosRepuesto({ codigo: "BATERÍA" })).toHaveProperty("error");
  });

  it("precio vacío queda en cero y uno negativo es error", () => {
    expect(cambiosRepuesto({ precioVenta: "" })).toEqual({ cambios: { precio_venta: 0 } });
    expect(cambiosRepuesto({ precioVenta: "-5" })).toHaveProperty("error");
    expect(cambiosRepuesto({ costo: "abc" })).toHaveProperty("error");
  });

  it("un cuerpo vacío es error", () => {
    expect(cambiosRepuesto({})).toHaveProperty("error");
  });
});

describe("cambiosArticulo", () => {
  it("convierte los datos del formulario en columnas", () => {
    expect(
      cambiosArticulo({ tipo: "celular", numeroSerie: "3567", costo: "", precioVenta: "900000", condicion: "usado_segunda" }),
    ).toEqual({
      cambios: { tipo: "celular", numero_serie: "3567", costo: 0, precio_venta: 900000, condicion: "usado_segunda" },
    });
  });

  it("valida la condición y no deja vaciar el tipo", () => {
    expect(cambiosArticulo({ condicion: "roto" })).toHaveProperty("error");
    expect(cambiosArticulo({ condicion: "" })).toEqual({ cambios: { condicion: null } });
    expect(cambiosArticulo({ tipo: "" })).toHaveProperty("error");
  });
});
