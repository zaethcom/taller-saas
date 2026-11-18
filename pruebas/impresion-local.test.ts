import { describe, expect, it } from "vitest";
import { bytesReciboLocal, textoImpresionLocal } from "../lib/sin-conexion/impresion-local";
import type { CargaMarcaEmpresa } from "../estacion/marca";

const marca: CargaMarcaEmpresa = {
  empresaNombre: "Polaco Scooter",
  empresaDireccion: "Calle 1",
  empresaTelefono: "300",
  reciboPie: "Gracias",
  logoRaster: null,
  anchoPapelMm: 80,
};

const texto = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("bytesReciboLocal", () => {
  it("arma el recibo de una venta sin conexión con el encabezado de la sede y sin número", () => {
    const t = texto(
      bytesReciboLocal(
        {
          tipo: "recibo_venta",
          carga: {
            numeroVenta: 0,
            items: [{ descripcion: "Vidrio templado", cantidad: 2, precioUnit: 15000 }],
            total: 30000,
            medioPago: "Efectivo",
            abreCajon: true,
            montoRecibido: 50000,
            cambio: 20000,
          },
        },
        marca,
        new Date("2026-11-18T21:00:00.000Z"),
      ),
    );
    expect(t).toContain("Polaco Scooter");
    expect(t).toContain("Venta sin conexion");
    expect(t).toContain("Vidrio templado");
    expect(t).toContain("18/11/2026");
    // Pulso del cajón (ESC p) porque es efectivo.
    expect(t).toContain("\x1bp");
  });

  it("con número (venta ya subida) dice Venta #N", () => {
    const t = texto(
      bytesReciboLocal(
        { tipo: "recibo_venta", carga: { numeroVenta: 41, items: [], total: 0, medioPago: "Nequi", abreCajon: false } },
        marca,
      ),
    );
    expect(t).toContain("Venta #41");
    expect(t).not.toContain("\x1bp");
  });

  it("el comprobante de recepción sin QR no invita a escanear", () => {
    const t = texto(
      bytesReciboLocal(
        {
          tipo: "comprobante_recepcion",
          carga: {
            numeroOrden: 21,
            codigoEntrada: "PS000021",
            clienteNombre: "Luis",
            clienteTelefono: "311",
            producto: "Motorola G8",
            serial: "Se asigna al subir",
            motivo: "Pantalla rota",
            fecha: "18/11/2026 4:00 p. m.",
            urlSeguimiento: "",
          },
        },
        marca,
      ),
    );
    expect(t).toContain("ORDEN #21");
    expect(t).toContain("PS000021");
    expect(t).not.toContain("Escanea");
  });
});

describe("textoImpresionLocal", () => {
  it("explica qué hacer si no hay impresora USB", () => {
    expect(textoImpresionLocal("sin_impresora")).toMatch(/USB/);
    expect(textoImpresionLocal("impreso")).toMatch(/imprimió/);
  });
});
