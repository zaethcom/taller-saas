import { describe, expect, it } from "vitest";
import {
  base64ABytes,
  coincide,
  elegirSalida,
  partir,
  type ConfiguracionUsb,
  type DispositivoUsb,
} from "../lib/impresion-usb";

const bulk = (n: number, direction: "in" | "out") => ({ endpointNumber: n, direction, type: "bulk" as const, packetSize: 64 });

describe("elegirSalida", () => {
  it("prefiere la interfaz de clase impresora con bulk OUT", () => {
    const configs: ConfiguracionUsb[] = [
      {
        configurationValue: 1,
        interfaces: [
          { interfaceNumber: 0, claimed: false, alternates: [{ alternateSetting: 0, interfaceClass: 255, endpoints: [bulk(2, "out")] }] },
          { interfaceNumber: 1, claimed: false, alternates: [{ alternateSetting: 0, interfaceClass: 7, endpoints: [bulk(1, "in"), bulk(3, "out")] }] },
        ],
      },
    ];
    expect(elegirSalida(configs)).toEqual({ configuracion: 1, interfaz: 1, alternativa: 0, endpoint: 3 });
  });

  it("acepta una interfaz de fabricante si no hay clase impresora", () => {
    const configs: ConfiguracionUsb[] = [
      {
        configurationValue: 1,
        interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ alternateSetting: 0, interfaceClass: 255, endpoints: [bulk(2, "out")] }] }],
      },
    ];
    expect(elegirSalida(configs)?.endpoint).toBe(2);
  });

  it("devuelve null si no hay por dónde escribir", () => {
    const configs: ConfiguracionUsb[] = [
      {
        configurationValue: 1,
        interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ alternateSetting: 0, interfaceClass: 7, endpoints: [bulk(1, "in")] }] }],
      },
    ];
    expect(elegirSalida(configs)).toBeNull();
  });
});

describe("partir", () => {
  it("parte en trozos del tamaño pedido sin perder bytes", () => {
    const datos = new Uint8Array(40_000).map((_, i) => i % 256);
    const trozos = partir(datos, 16_384);
    expect(trozos.map((t) => t.length)).toEqual([16_384, 16_384, 7_232]);
    expect(trozos[2]?.[0]).toBe(datos[32_768]);
  });
});

describe("coincide", () => {
  const d = { vendorId: 0x0a5f, productId: 0x0081, serialNumber: "ZP1" } as DispositivoUsb;
  it("compara vendor, producto y serial", () => {
    expect(coincide(d, { vendorId: 0x0a5f, productId: 0x0081, serialNumber: "ZP1", nombre: "" })).toBe(true);
    expect(coincide(d, { vendorId: 0x0a5f, productId: 0x0081, serialNumber: "otro", nombre: "" })).toBe(false);
  });
  it("sin serial guardado, basta vendor y producto", () => {
    expect(coincide(d, { vendorId: 0x0a5f, productId: 0x0081, nombre: "" })).toBe(true);
  });
});

describe("base64ABytes", () => {
  it("decodifica bytes binarios", () => {
    expect([...base64ABytes("G0AKHVZC")]).toEqual([0x1b, 0x40, 0x0a, 0x1d, 0x56, 0x42]);
  });
});
