import { describe, expect, it } from "vitest";
import { mensajeEncargoListo, normalizarEncargo } from "../lib/compras/encargo";

describe("normalizarEncargo", () => {
  it("pide qué traer, nombre y teléfono del cliente", () => {
    const r = normalizarEncargo({ descripcion: " Pantalla  A12 ", cantidad: "2", clienteNombre: "Ana Pérez", clienteTelefono: "300 123 4567" });
    expect(r).toEqual({
      ok: true,
      datos: {
        descripcion: "Pantalla A12",
        cantidad: 2,
        prioridad: "normal",
        clienteId: null,
        clienteNombre: "Ana Pérez",
        clienteTelefono: "300 123 4567",
      },
    });
    expect(normalizarEncargo({ descripcion: "", clienteNombre: "Ana", clienteTelefono: "3001234567" }).ok).toBe(false);
    expect(normalizarEncargo({ descripcion: "x", clienteNombre: "", clienteTelefono: "3001234567" }).ok).toBe(false);
    expect(normalizarEncargo({ descripcion: "x", clienteNombre: "Ana", clienteTelefono: "12" }).ok).toBe(false);
  });

  it("una prioridad desconocida queda normal", () => {
    const r = normalizarEncargo({ descripcion: "x", prioridad: "ya", clienteNombre: "Ana", clienteTelefono: "3001234567" });
    expect(r.ok && r.datos.prioridad).toBe("normal");
  });
});

describe("mensajeEncargoListo", () => {
  it("usa el nombre guardado y lo que llegó", () => {
    expect(mensajeEncargoListo({ clienteNombre: "Ana Pérez", producto: "Vidrio templado y estuche" })).toBe(
      "Hola Ana Pérez, ya llegó tu vidrio templado y estuche. Pasa lo más pronto posible.",
    );
  });

  it("no cambia marcas ni códigos", () => {
    expect(mensajeEncargoListo({ clienteNombre: null, producto: "iPhone 11 pantalla" })).toBe(
      "Hola, ya llegó tu iPhone 11 pantalla. Pasa lo más pronto posible.",
    );
    expect(mensajeEncargoListo({ clienteNombre: "Luis", producto: "A12 batería" })).toBe(
      "Hola Luis, ya llegó tu A12 batería. Pasa lo más pronto posible.",
    );
  });
});
