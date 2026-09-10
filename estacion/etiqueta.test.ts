import { describe, expect, it } from "vitest";
import { etiquetaQrZpl } from "./etiqueta";

describe("etiquetaQrZpl", () => {
  const base = {
    serial: "RL-000123",
    tipo: "patineta",
    marca: "Xiaomi",
    modelo: "Pro 2",
    numeroOrden: 45,
    contenidoQr: "https://taller.example.com/s/RL-000123",
  };

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
