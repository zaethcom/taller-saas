import { describe, expect, it } from "vitest";
import { generarCodigoVinculacion, normalizarCodigo } from "../lib/estacion-codigo";
import { aBytes, resolverImpresion } from "../estacion/resolver";

describe("código de vinculación", () => {
  it("se muestra como XXXX-XXXX sin caracteres que se confunden", () => {
    for (let i = 0; i < 200; i++) {
      expect(generarCodigoVinculacion()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    }
  });

  it("acepta minúsculas, espacios y sin guion: es el mismo código", () => {
    const c = generarCodigoVinculacion();
    const canon = normalizarCodigo(c);
    expect(canon).toHaveLength(8);
    expect(normalizarCodigo(c.toLowerCase())).toBe(canon);
    expect(normalizarCodigo(c.replace("-", " "))).toBe(canon);
    expect(normalizarCodigo(c.replace("-", ""))).toBe(canon);
  });

  it("rechaza lo que no puede ser un código", () => {
    expect(normalizarCodigo("")).toBeNull();
    expect(normalizarCodigo("ABCD-EFG")).toBeNull();
    expect(normalizarCodigo("ABCD-EFG0")).toBeNull(); // el 0 no está en el alfabeto
  });
});

describe("resolverImpresion para la app Android", () => {
  it("un recibo va a tickets como bytes ESC/POS", () => {
    const r = resolverImpresion({
      id: "1",
      tipo: "recibo_venta",
      carga: {
        numeroVenta: 0,
        items: [{ descripcion: "PRUEBA", cantidad: 1, precioUnit: 0 }],
        total: 0,
        medioPago: "Prueba",
        abreCajon: false,
        empresaNombre: "Taller",
        empresaDireccion: null,
        empresaTelefono: null,
        reciboPie: "Gracias",
      },
    });
    expect(r.destino).toBe("tickets");
    expect(aBytes(r.contenido)[0]).toBe(0x1b); // ESC @, inicializar
  });

  it("abrir el cajón va a tickets", () => {
    expect(resolverImpresion({ id: "2", tipo: "abrir_cajon", carga: { motivo: "x" } }).destino).toBe("tickets");
  });

  it("un tipo desconocido falla en vez de imprimir en cualquier impresora", () => {
    expect(() => {
      const r = resolverImpresion({ id: "3", tipo: "otro" as never, carga: {} });
      return r.destino;
    }).toThrow();
  });
});
