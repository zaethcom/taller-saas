import { describe, expect, it } from "vitest";
import { etiquetaArticuloZpl, etiquetaQrZpl, etiquetaRepuestoZpl } from "./etiqueta";

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
