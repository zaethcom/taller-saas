import { describe, expect, it } from "vitest";
import { resolverImpresion, type TrabajoPendiente } from "./ruteo";

/**
 * Lo que de verdad importa acá es el DESTINO, no los bytes: el contenido
 * ya lo cubren etiqueta.test.ts y escpos.test.ts. Una etiqueta ruteada a
 * la impresora de tickets no falla con un error -- saca papel con basura,
 * o no saca nada -- así que es un fallo que solo se ve en el mostrador.
 */
const marca = {
  empresaNombre: "Taller de Prueba",
  empresaDireccion: null,
  empresaTelefono: null,
  reciboPie: "Gracias",
};

const trabajos: { tipo: TrabajoPendiente["tipo"]; carga: unknown; destino: string }[] = [
  {
    tipo: "recibo_venta",
    destino: "tickets",
    carga: { ...marca, numeroVenta: 1, items: [], total: 0, medioPago: "efectivo", abreCajon: false },
  },
  {
    tipo: "comprobante_recepcion",
    destino: "tickets",
    carga: {
      ...marca,
      numeroOrden: 1,
      codigoEntrada: "RL-000001",
      clienteNombre: "Cliente",
      clienteTelefono: null,
      producto: "Patineta",
      serial: "SN1",
      motivo: "No enciende",
      fecha: "2026-01-01",
      urlSeguimiento: "https://example.com/t/abc",
    },
  },
  {
    tipo: "cierre_caja",
    destino: "tickets",
    carga: {
      ...marca,
      aperturaEn: "2026-01-01",
      cierreEn: "2026-01-01",
      baseInicial: 0,
      totalVentas: 0,
      efectivoEsperado: 0,
      efectivoContado: 0,
      diferencia: 0,
    },
  },
  {
    tipo: "comprobante_traslado",
    destino: "tickets",
    carga: {
      ...marca,
      numeroTraslado: 1,
      sedeOrigenNombre: "Local 1",
      sedeDestinoNombre: "Local 2",
      items: [],
      nota: null,
      fecha: "2026-01-01",
    },
  },
  { tipo: "abrir_cajon", destino: "tickets", carga: {} },
  {
    tipo: "etiqueta_qr",
    destino: "etiquetas",
    carga: {
      etiquetaRaster: { anchoDots: 8, altoDots: 1, datosBase64: Buffer.from([0xff]).toString("base64") },
    },
  },
  {
    tipo: "etiqueta_articulo",
    destino: "etiquetas",
    carga: { codigo: "ART-000001", tipo: "patineta", marca: "Xiaomi", modelo: "Pro 2" },
  },
  {
    tipo: "etiqueta_repuesto",
    destino: "etiquetas",
    carga: { nombreEmpresa: "Taller", codigo: "REP-1", descripcion: "Llanta", cantidadCopias: 1 },
  },
];

describe("resolverImpresion", () => {
  for (const { tipo, carga, destino } of trabajos) {
    it(`${tipo} sale por la impresora de ${destino}`, () => {
      expect(resolverImpresion({ id: "1", tipo, carga }).destino).toBe(destino);
    });
  }

  it("no deja ningún tipo sin contenido que enviar", () => {
    for (const { tipo, carga } of trabajos) {
      const { contenido } = resolverImpresion({ id: "1", tipo, carga });
      expect(contenido.length).toBeGreaterThan(0);
    }
  });

  it("las etiquetas nunca caen en la impresora de tickets", () => {
    const etiquetas = trabajos.filter((t) => t.tipo.startsWith("etiqueta_"));
    expect(etiquetas).toHaveLength(3);
    for (const { tipo, carga } of etiquetas) {
      expect(resolverImpresion({ id: "1", tipo, carga }).destino).toBe("etiquetas");
    }
  });
});
