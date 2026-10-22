import { describe, expect, it } from "vitest";
import { reciboVenta, type CargaReciboVenta } from "./recibo";
import { inicializar, abrirCajon, dosColumnas, ajustar, juntar } from "../escpos";

const BASE: CargaReciboVenta = {
  numeroVenta: 1,
  items: [{ descripcion: "Repuesto", cantidad: 1, precioUnit: 1000 }],
  total: 1000,
  medioPago: "Efectivo",
  abreCajon: true,
  empresaNombre: "Taller",
  empresaDireccion: null,
  empresaTelefono: null,
  reciboPie: "Gracias",
};

describe("reciboVenta() -- imprimir desmarcado", () => {
  it("con imprimir=false y abreCajon=true, solo manda init + el pulso del cajón", () => {
    const buf = reciboVenta({ ...BASE, imprimir: false });
    expect(buf).toEqual(Buffer.concat([inicializar(), abrirCajon()]));
  });

  it("con imprimir=false y abreCajon=false, no manda nada más que init", () => {
    const buf = reciboVenta({ ...BASE, imprimir: false, abreCajon: false });
    expect(buf).toEqual(inicializar());
  });

  it("sin imprimir (undefined) se comporta como true -- imprime el ticket completo", () => {
    const conDefault = reciboVenta(BASE);
    const conTrueExplicito = reciboVenta({ ...BASE, imprimir: true });
    expect(conDefault).toEqual(conTrueExplicito);
    expect(conDefault.length).toBeGreaterThan(inicializar().length + abrirCajon().length);
  });
});

describe("reciboVenta() -- compacto", () => {
  it("pone cada ítem y su monto en un solo renglón cuando caben", () => {
    const txt = reciboVenta(BASE).toString("latin1");
    expect(txt).toMatch(/1 x Repuesto +\$1\.000\n/);
  });

  it("parte en dos renglones un ítem demasiado largo", () => {
    const largo = "Pantalla original con marco y bateria Samsung Galaxy";
    const txt = reciboVenta({ ...BASE, items: [{ descripcion: largo, cantidad: 1, precioUnit: 1000 }] }).toString("latin1");
    expect(txt).toMatch(/1 x Pantalla original con marco y bateria\nSamsung Galaxy +\$1\.000\n/);
  });
});

describe("reciboVenta() -- cliente", () => {
  it("sin cliente (consumidor final) no imprime ningún renglón de cliente", () => {
    expect(reciboVenta(BASE).toString("latin1")).not.toContain("Cliente:");
  });

  it("imprime nombre, documento y teléfono del cliente antes de los ítems", () => {
    const txt = reciboVenta({
      ...BASE,
      cliente: { nombre: "Ana Pérez", documento: "1023456", telefono: "3001234567" },
    }).toString("latin1");
    expect(txt).toContain("Cliente: Ana P");
    expect(txt).toMatch(/Doc\. 1023456 - Tel\. 3001234567\n/);
    expect(txt.indexOf("Cliente:")).toBeLessThan(txt.indexOf("1 x Repuesto"));
  });

  it("sin documento ni teléfono, solo el nombre", () => {
    const txt = reciboVenta({ ...BASE, cliente: { nombre: "Ana", documento: null, telefono: null } }).toString("latin1");
    expect(txt).toContain("Cliente: Ana\n");
    expect(txt).not.toContain("Doc.");
  });
});

describe("dosColumnas()", () => {
  it("rellena con espacios hasta el ancho", () => {
    expect(dosColumnas("A", "B", 5)).toBe("A   B");
  });
  it("devuelve null si no cabe", () => {
    expect(dosColumnas("ABC", "DEF", 6)).toBeNull();
  });
});

describe("papel de 58 mm", () => {
  it("ningún renglón pasa de 32 letras", () => {
    const txt = reciboVenta({
      ...BASE,
      anchoPapelMm: 58,
      items: [{ descripcion: "Mano de obra cambio de pantalla completa", cantidad: 1, precioUnit: 40000 }],
      montoRecibido: 100000,
      cuentaOrden: { numeroOrden: 21, valor: 250000, abonadoAntes: 50000, estePago: 100000, saldo: 100000 },
    })
      .toString("latin1")
      .replace(/\x1b[@]|\x1b[3aE].|\x1d!.|\x1dVB.|\x1bp.../gs, "");
    for (const linea of txt.split("\n")) expect(linea.length).toBeLessThanOrEqual(32);
  });
});

describe("ajustar() y juntar()", () => {
  it("parte por palabras", () => {
    expect(ajustar("Mano de obra cambio de pantalla", 12)).toEqual(["Mano de obra", "cambio de", "pantalla"]);
  });
  it("corta una palabra más larga que el renglón", () => {
    expect(ajustar("ABCDEFGH", 3)).toEqual(["ABC", "DEF", "GH"]);
  });
  it("junta con guion mientras quepa", () => {
    expect(juntar(["Uno", "Dos", "Tres"], 10)).toEqual(["Uno - Dos", "Tres"]);
    expect(juntar(["Uno", "", "Dos"], 20)).toEqual(["Uno - Dos"]);
  });
});

describe("cuenta de un encargo", () => {
  it("usa el título y la etiqueta del valor en vez de la orden", () => {
    const txt = reciboVenta({
      ...BASE,
      cuentaOrden: { titulo: "Encargo: Vidrio", etiquetaValor: "Valor", valor: 50000, abonadoAntes: 0, estePago: 20000, saldo: 30000 },
    }).toString("latin1");
    expect(txt).toContain("Encargo: Vidrio");
    expect(txt).not.toContain("Orden #");
    expect(txt).not.toContain("Valor del servicio");
  });
});
