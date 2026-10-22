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
  it("saluda por el primer nombre", () => {
    expect(mensajeEncargoListo({ clienteNombre: "Ana Pérez", producto: "Pantalla A12" })).toBe(
      "Hola Ana, ya llegó lo que encargaste: Pantalla A12. Te esperamos.",
    );
  });
});
