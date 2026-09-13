import { describe, expect, it } from "vitest";
import {
  etiquetaArticuloTicket,
  etiquetaArticuloZpl,
  etiquetaQrTicket,
  etiquetaQrZpl,
} from "./etiqueta";
import { resolverImpresion } from "./ruteo";

/**
 * Las líneas del papel sin los comandos ESC/POS que van intercalados
 * (negrita, tamaño, alineación). Sirve para medir el recuadro: un
 * `\x1bE\x01` delante del borde cuenta como tres caracteres que la
 * impresora nunca imprime.
 */
function lineasImpresas(bytes: Buffer): string[] {
  return bytes
    .toString("latin1")
    .split("\n")
    .map((l) => l.replace(/[\x1b\x1d]./g, "").replace(/[\x00-\x1f]/g, ""));
}

/**
 * Las etiquetas se imprimen en la impresora de tickets, así que lo que
 * hay que verificar es ESC/POS: que la impresora reciba la orden de
 * dibujar el QR ella misma, que corte el papel al final -- sin corte la
 * etiqueta sale pegada al siguiente recibo -- y que el texto esté.
 */
describe("etiquetaQrTicket", () => {
  const base = {
    serial: "RL-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    numeroOrden: 45,
    contenidoQr: "https://taller.example.com/s/RL-000123",
    empresaNombre: "Polaco Scooter",
  };

  /** Los bytes que la impresora lee como "imprime el QR que te acabo de cargar". */
  const IMPRIMIR_QR = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
  const CORTE = Buffer.from([0x1d, 0x56, 0x42, 0x00]);
  const INICIALIZAR = Buffer.from([0x1b, 0x40]);

  it("empieza inicializando la impresora, que puede venir de imprimir un recibo", () => {
    expect(etiquetaQrTicket(base).subarray(0, 2)).toEqual(INICIALIZAR);
  });

  it("manda dibujar el QR con el contenido pedido", () => {
    const bytes = etiquetaQrTicket(base);
    expect(bytes.includes(Buffer.from(base.contenidoQr, "ascii"))).toBe(true);
    expect(bytes.includes(IMPRIMIR_QR)).toBe(true);
  });

  it("corta el papel al final para poder despegar la etiqueta", () => {
    const bytes = etiquetaQrTicket(base);
    expect(bytes.subarray(bytes.length - CORTE.length)).toEqual(CORTE);
  });

  it("imprime el serial, marca y modelo, y el número de orden", () => {
    const texto = etiquetaQrTicket(base).toString("latin1");
    expect(texto).toContain("RL-000123");
    expect(texto).toContain("Xiaomi Pro 2");
    expect(texto).toContain("Orden #45");
  });

  it("cae al tipo de producto si no hay marca ni modelo", () => {
    const texto = etiquetaQrTicket({ ...base, marca: null, modelo: null }).toString("latin1");
    expect(texto).toContain("patineta");
  });

  it("dibuja el recuadro con el nombre de la empresa", () => {
    const texto = etiquetaQrTicket(base).toString("latin1");
    expect(texto).toContain("Polaco Scooter");
    expect(texto).toContain("+==");
  });

  it("las tres líneas del recuadro miden lo mismo, o queda torcido en el papel", () => {
    const lineas = lineasImpresas(etiquetaQrTicket(base)).filter(
      (l) => l.startsWith("+") || l.startsWith("|"),
    );

    expect(lineas.length).toBe(3);
    expect(new Set(lineas.map((l) => l.length)).size).toBe(1);
  });

  it("no dibuja un recuadro vacío si el trabajo venía sin nombre de empresa", () => {
    // Los trabajos encolados antes de este cambio no traen empresaNombre y
    // tienen que imprimir igual: siguen en la cola.
    const texto = etiquetaQrTicket({ ...base, empresaNombre: undefined }).toString("latin1");
    expect(texto).not.toContain("+==");
    expect(texto).toContain("RL-000123");
  });

  it("recorta un nombre de empresa largo en vez de romper el recuadro", () => {
    const largo = "Taller de patinetas y bicicletas eléctricas del centro";
    const lineas = lineasImpresas(etiquetaQrTicket({ ...base, empresaNombre: largo })).filter(
      (l) => l.startsWith("+") || l.startsWith("|"),
    );

    expect(lineas.length).toBe(3);
    expect(new Set(lineas.map((l) => l.length)).size).toBe(1);
  });
});

describe("etiquetaArticuloTicket", () => {
  const base = {
    codigo: "ART-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    empresaNombre: "Polaco Scooter",
  };

  it("el QR codifica el código del artículo, no una URL", () => {
    const bytes = etiquetaArticuloTicket(base);
    expect(bytes.includes(Buffer.from(base.codigo, "ascii"))).toBe(true);
  });

  it("no imprime número de orden -- un artículo no nace de una orden", () => {
    expect(etiquetaArticuloTicket(base).toString("latin1")).not.toContain("Orden #");
  });

  it("corta el papel al final", () => {
    const bytes = etiquetaArticuloTicket(base);
    expect(bytes.subarray(bytes.length - 4)).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
  });
});

/**
 * El ruteo es lo que de verdad cambió: la etiqueta tiene que salir por
 * la impresora de tickets mientras no haya etiquetadora configurada.
 */
describe("resolverImpresion", () => {
  const trabajoEtiqueta = {
    id: "t1",
    tipo: "etiqueta_qr" as const,
    carga: {
      serial: "RL-1",
      tipo: "patineta",
      marca: null,
      modelo: null,
      numeroOrden: 1,
      contenidoQr: "https://x/y",
      empresaNombre: "Polaco Scooter",
    },
  };

  it("sin etiquetadora, la etiqueta sale por la impresora de tickets en ESC/POS", () => {
    const { destino, contenido } = resolverImpresion(trabajoEtiqueta, false);
    expect(destino).toBe("tickets");
    expect(Buffer.isBuffer(contenido)).toBe(true);
  });

  it("con etiquetadora, vuelve a salir en ZPL por la suya sin tocar nada más", () => {
    const { destino, contenido } = resolverImpresion(trabajoEtiqueta, true);
    expect(destino).toBe("etiquetas");
    expect(typeof contenido).toBe("string");
    expect(contenido as string).toContain("^XA");
  });

  it("un recibo sale por tickets pase lo que pase", () => {
    const trabajo = {
      id: "t2",
      tipo: "abrir_cajon" as const,
      carga: { motivo: "prueba" },
    };
    expect(resolverImpresion(trabajo, true).destino).toBe("tickets");
    expect(resolverImpresion(trabajo, false).destino).toBe("tickets");
  });
});

describe("las variantes ZPL, para cuando exista una etiquetadora", () => {
  const base = {
    serial: "RL-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    numeroOrden: 45,
    contenidoQr: "https://taller.example.com/s/RL-000123",
  };

  it("abre con ^XA y cierra con ^XZ", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("incluye el contenido del QR y el serial", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain(`^FDMM,A${base.contenidoQr}^FS`);
    expect(zpl).toContain(`^FD${base.serial}^FS`);
  });

  it("la de artículo codifica el código y no imprime orden", () => {
    const zpl = etiquetaArticuloZpl({ codigo: "ART-1", tipo: "patineta", marca: null, modelo: null });
    expect(zpl).toContain("^FDMM,AART-1^FS");
    expect(zpl).not.toContain("Orden #");
  });
});
