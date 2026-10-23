import { describe, expect, it } from "vitest";
import { comprobanteRecepcion, type CargaComprobanteRecepcion } from "./comprobante";
import { generarQrRaster } from "../../lib/qr-bitmap";

const BASE: CargaComprobanteRecepcion = {
  numeroOrden: 10,
  codigoEntrada: "PS000010",
  clienteNombre: "Hamilton Escobar",
  clienteTelefono: "3145546543",
  producto: "lenovo x686",
  serial: "8665864765",
  motivo: "pantalla rota",
  fecha: "22/10/2026",
  urlSeguimiento: "https://taller360.app/seguimiento/abc",
  empresaNombre: "Taller",
  empresaDireccion: null,
  empresaTelefono: null,
  reciboPie: "Gracias",
};

const texto = (c: CargaComprobanteRecepcion) => comprobanteRecepcion(c).toString("latin1");

describe("comprobanteRecepcion()", () => {
  it("dice quién recibió el equipo", () => {
    expect(texto({ ...BASE, recibidoPor: "Pepito Perez" })).toMatch(/Recibi.: Pepito Perez\n/);
  });

  it("un trabajo viejo sin responsable sigue imprimiendo", () => {
    expect(texto(BASE)).not.toMatch(/Recibi.:/);
  });

  it("parte por palabras la frase larga en vez de dejar que la impresora corte 'eq / uipo'", () => {
    expect(texto(BASE)).toMatch(/Conserve este recibo para reclamar su\nequipo\n/);
  });
});

describe("generarQrRaster()", () => {
  it("cabe en el área de impresión de 80mm (480 puntos): más ancho sale rayado", async () => {
    const qr = await generarQrRaster("https://taller360.app/seguimiento/abc");
    expect(qr.anchoDots).toBe(480);
  });
});
