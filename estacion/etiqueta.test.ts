import { describe, expect, it } from "vitest";
import {
  etiquetaArticuloTicket,
  etiquetaArticuloZpl,
  etiquetaQrTicket,
  etiquetaQrZpl,
  etiquetaRepuestoTicket,
  etiquetaRepuestoZpl,
} from "./etiqueta";
import { resolverImpresion } from "./ruteo";

describe("etiquetaQrZpl", () => {
  const base = {
    nombreEmpresa: "Polaco Scooter",
    codigoEntrada: "PS000045",
    serial: "RL-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    numeroOrden: 45,
    contenidoQr: "https://taller.example.com/s/RL-000123",
  };

  it("muestra el nombre de la empresa", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain(`^FD${base.nombreEmpresa}^FS`);
  });

  it("muestra el código de entrada en su propio campo", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain(`^FD${base.codigoEntrada}^FS`);
  });

  it("abre con ^XA y cierra con ^XZ, como todo bloque ZPL válido", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("incluye el contenido del QR dentro del campo de datos ^FD...^FS", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain(`^FDMM,A${base.contenidoQr}^FS`);
  });

  it("muestra el serial en su propio campo de texto", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain(`^FD${base.serial}^FS`);
  });

  it("junta marca y modelo cuando ambos existen", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain("^FDXiaomi Pro 2^FS");
  });

  it("cae al tipo de producto si no hay marca ni modelo", () => {
    const zpl = etiquetaQrZpl({ ...base, marca: null, modelo: null });
    expect(zpl).toContain("^FDpatineta^FS");
  });

  it("muestra solo la marca si no hay modelo", () => {
    const zpl = etiquetaQrZpl({ ...base, modelo: null });
    expect(zpl).toContain("^FDXiaomi^FS");
  });

  it("incluye el número de orden para poder rastrear una etiqueta despegada", () => {
    const zpl = etiquetaQrZpl(base);
    expect(zpl).toContain("^FDOrden #45^FS");
  });
});

describe("etiquetaArticuloZpl", () => {
  const base = {
    codigo: "ART-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
  };

  it("abre con ^XA y cierra con ^XZ", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("el QR codifica el código del artículo, no una URL", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl).toContain(`^FDMM,A${base.codigo}^FS`);
  });

  it("muestra el código en su propio campo de texto grande", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl).toContain(`^FD${base.codigo}^FS`);
  });

  it("junta marca y modelo cuando ambos existen", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl).toContain("^FDXiaomi Pro 2^FS");
  });

  it("cae al tipo si no hay marca ni modelo", () => {
    const zpl = etiquetaArticuloZpl({ ...base, marca: null, modelo: null });
    expect(zpl).toContain("^FDpatineta^FS");
  });

  it("no imprime número de orden -- un artículo no nace de una orden", () => {
    const zpl = etiquetaArticuloZpl(base);
    expect(zpl).not.toContain("Orden #");
  });
});

describe("etiquetaRepuestoZpl", () => {
  const base = {
    nombreEmpresa: "Polaco Scooter",
    codigo: "F-1023",
    descripcion: "Pastilla de freno delantera",
    cantidadCopias: 3,
  };

  it("abre con ^XA y cierra con ^XZ", () => {
    const zpl = etiquetaRepuestoZpl(base);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trimEnd().endsWith("^XZ")).toBe(true);
  });

  it("dibuja un código de barras Code128 con el código del repuesto", () => {
    const zpl = etiquetaRepuestoZpl(base);
    expect(zpl).toContain("^BCN,80,Y,N,N");
    expect(zpl).toContain(`^FD${base.codigo}^FS`);
  });

  it("muestra el nombre de la empresa y la descripción del repuesto", () => {
    const zpl = etiquetaRepuestoZpl(base);
    expect(zpl).toContain(`^FD${base.nombreEmpresa}^FS`);
    expect(zpl).toContain(`^FD${base.descripcion}^FS`);
  });

  it("pide una copia por cada unidad recibida, antes de cerrar el formato", () => {
    const zpl = etiquetaRepuestoZpl(base);
    expect(zpl).toContain("^PQ3");
    expect(zpl.indexOf("^PQ3")).toBeLessThan(zpl.lastIndexOf("^XZ"));
  });

  it("no usa QR -- un repuesto se escanea como cualquier producto de estante", () => {
    const zpl = etiquetaRepuestoZpl(base);
    expect(zpl).not.toContain("^BQN");
  });
});

/**
 * Las variantes ESC/POS, que son las que se usan mientras ninguna sede
 * tenga etiquetadora. Lo que hay que verificar es que la impresora
 * reciba la orden de dibujar el código ella misma, que corte al final
 * -- sin corte la etiqueta sale pegada al siguiente recibo -- y que el
 * texto esté.
 */
const INICIALIZAR = Buffer.from([0x1b, 0x40]);
const IMPRIMIR_QR = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
const CODE128 = Buffer.from([0x1d, 0x6b, 0x49]);
const CORTE = Buffer.from([0x1d, 0x56, 0x42, 0x00]);

/**
 * Las líneas del papel sin los comandos ESC/POS intercalados (negrita,
 * tamaño, alineación). Sirve para medir el recuadro: un `\x1bE\x01`
 * delante del borde cuenta como tres caracteres que nunca se imprimen.
 */
function lineasImpresas(bytes: Buffer): string[] {
  return bytes
    .toString("latin1")
    .split("\n")
    .map((l) => l.replace(/[\x1b\x1d]./g, "").replace(/[\x00-\x1f]/g, ""));
}

describe("etiquetaQrTicket", () => {
  const base = {
    nombreEmpresa: "Polaco Scooter",
    codigoEntrada: "PS000045",
    serial: "RL-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    numeroOrden: 45,
    contenidoQr: "https://taller.example.com/s/RL-000123",
  };

  it("inicializa la impresora, que puede venir de imprimir un recibo", () => {
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

  it("imprime el código de entrada, el serial, marca/modelo y la orden", () => {
    const texto = etiquetaQrTicket(base).toString("latin1");
    expect(texto).toContain("PS000045");
    expect(texto).toContain("RL-000123");
    expect(texto).toContain("Xiaomi Pro 2");
    expect(texto).toContain("Orden #45");
  });

  it("cae al tipo de producto si no hay marca ni modelo", () => {
    const texto = etiquetaQrTicket({ ...base, marca: null, modelo: null }).toString("latin1");
    expect(texto).toContain("patineta");
  });

  it("las tres líneas del recuadro miden lo mismo, o queda torcido", () => {
    const lineas = lineasImpresas(etiquetaQrTicket(base)).filter(
      (l) => l.startsWith("+") || l.startsWith("|"),
    );
    expect(lineas.length).toBe(3);
    expect(new Set(lineas.map((l) => l.length)).size).toBe(1);
  });

  it("recorta un nombre de empresa largo en vez de romper el recuadro", () => {
    const largo = "Taller de patinetas y bicicletas eléctricas del centro";
    const lineas = lineasImpresas(etiquetaQrTicket({ ...base, nombreEmpresa: largo })).filter(
      (l) => l.startsWith("+") || l.startsWith("|"),
    );
    expect(lineas.length).toBe(3);
    expect(new Set(lineas.map((l) => l.length)).size).toBe(1);
  });

  it("sin nombre de empresa no dibuja un recuadro vacío", () => {
    const texto = etiquetaQrTicket({ ...base, nombreEmpresa: "" }).toString("latin1");
    expect(texto).not.toContain("+==");
    expect(texto).toContain("PS000045");
  });
});

describe("etiquetaArticuloTicket", () => {
  const base = { codigo: "ART-000123", tipo: "patineta", marca: "Xiaomi", modelo: "Pro 2" };

  it("el QR codifica el código del artículo, no una URL", () => {
    expect(etiquetaArticuloTicket(base).includes(Buffer.from(base.codigo, "ascii"))).toBe(true);
  });

  it("no imprime número de orden -- un artículo no nace de una orden", () => {
    expect(etiquetaArticuloTicket(base).toString("latin1")).not.toContain("Orden #");
  });
});

describe("etiquetaRepuestoTicket", () => {
  const base = {
    nombreEmpresa: "Polaco Scooter",
    codigo: "REP-SAM-OLED",
    descripcion: "Pantalla OLED Samsung A",
    cantidadCopias: 3,
  };

  it("usa código de barras, no QR -- un repuesto se escanea en caja", () => {
    const bytes = etiquetaRepuestoTicket(base);
    expect(bytes.includes(CODE128)).toBe(true);
    expect(bytes.includes(IMPRIMIR_QR)).toBe(false);
  });

  it("selecciona el juego B, que es el que admite letras y guiones", () => {
    expect(etiquetaRepuestoTicket(base).toString("latin1")).toContain(`{B${base.codigo}`);
  });

  it("repite la etiqueta entera una vez por unidad recibida", () => {
    // ESC/POS no tiene el ^PQ de ZPL: las copias se repiten aquí.
    const bytes = etiquetaRepuestoTicket(base);
    let cortes = 0;
    for (let i = 0; i <= bytes.length - CORTE.length; i++) {
      if (bytes.subarray(i, i + CORTE.length).equals(CORTE)) cortes++;
    }
    expect(cortes).toBe(3);
  });

  it("nunca imprime menos de una etiqueta, aunque la cantidad venga en cero", () => {
    const bytes = etiquetaRepuestoTicket({ ...base, cantidadCopias: 0 });
    expect(bytes.subarray(bytes.length - CORTE.length)).toEqual(CORTE);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

/**
 * El ruteo es lo que decide si una sede imprime sus etiquetas en ZPL o
 * en ESC/POS. Equivocarlo saca papel con basura en vez de un error.
 */
describe("resolverImpresion", () => {
  const cargaQr = {
    nombreEmpresa: "Polaco Scooter",
    codigoEntrada: "PS000001",
    serial: "RL-1",
    tipo: "patineta",
    marca: null,
    modelo: null,
    numeroOrden: 1,
    contenidoQr: "https://x/y",
  };

  for (const tipo of ["etiqueta_qr", "etiqueta_articulo", "etiqueta_repuesto"] as const) {
    const carga =
      tipo === "etiqueta_qr"
        ? cargaQr
        : tipo === "etiqueta_articulo"
          ? { codigo: "ART-1", tipo: "patineta", marca: null, modelo: null }
          : { nombreEmpresa: "Polaco Scooter", codigo: "REP-1", descripcion: "x", cantidadCopias: 1 };

    it(`${tipo}: sin etiquetadora sale por la impresora de tickets, en bytes`, () => {
      const { destino, contenido } = resolverImpresion({ id: "t", tipo, carga }, false);
      expect(destino).toBe("tickets");
      expect(Buffer.isBuffer(contenido)).toBe(true);
    });

    it(`${tipo}: con etiquetadora sale por la suya, en ZPL`, () => {
      const { destino, contenido } = resolverImpresion({ id: "t", tipo, carga }, true);
      expect(destino).toBe("etiquetas");
      expect(typeof contenido).toBe("string");
      expect(contenido as string).toContain("^XA");
    });
  }

  it("un recibo sale por tickets haya o no etiquetadora", () => {
    const trabajo = { id: "t2", tipo: "abrir_cajon" as const, carga: { motivo: "prueba" } };
    expect(resolverImpresion(trabajo, true).destino).toBe("tickets");
    expect(resolverImpresion(trabajo, false).destino).toBe("tickets");
  });
});
