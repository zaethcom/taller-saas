import { describe, expect, it } from "vitest";
import {
  abrirCajon,
  alinear,
  componer,
  cortar,
  inicializar,
  negrita,
  qr,
  salto,
  tamano,
  texto,
} from "./escpos";

describe("comandos de control", () => {
  it("inicializar es ESC @", () => {
    expect(inicializar()).toEqual(Buffer.from([0x1b, 0x40]));
  });

  it("abrirCajon manda el pulso exacto ESC p 0 25 250", () => {
    // Este es el comando que de verdad abre el cajón. Si algún byte
    // cambia aquí sin querer, el cajón deja de abrirse en producción
    // y nadie lo nota hasta que un cajero se queda sin poder cobrar.
    expect(abrirCajon()).toEqual(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  });

  it("cortar manda GS V 66 0 (corte parcial con pestaña)", () => {
    expect(cortar()).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
  });

  it("negrita activa y desactiva con ESC E 1 / ESC E 0", () => {
    expect(negrita(true)).toEqual(Buffer.from([0x1b, 0x45, 1]));
    expect(negrita(false)).toEqual(Buffer.from([0x1b, 0x45, 0]));
  });

  it("alinear mapea izquierda/centro/derecha a 0/1/2", () => {
    expect(alinear("izquierda")).toEqual(Buffer.from([0x1b, 0x61, 0]));
    expect(alinear("centro")).toEqual(Buffer.from([0x1b, 0x61, 1]));
    expect(alinear("derecha")).toEqual(Buffer.from([0x1b, 0x61, 2]));
  });

  it("tamano dobla ancho y alto juntos, o vuelve al normal", () => {
    expect(tamano(true)).toEqual(Buffer.from([0x1d, 0x21, 0x11]));
    expect(tamano(false)).toEqual(Buffer.from([0x1d, 0x21, 0x00]));
  });

  it("salto produce ese número de saltos de línea, uno por defecto", () => {
    expect(salto()).toEqual(Buffer.from([0x0a]));
    expect(salto(3)).toEqual(Buffer.from([0x0a, 0x0a, 0x0a]));
  });
});

describe("texto()", () => {
  it("codifica en latin1 para que tildes y ñ salgan bien", () => {
    expect(texto("Ñandú")).toEqual(Buffer.from("Ñandú", "latin1"));
  });
});

describe("qr()", () => {
  it("codifica la longitud de los datos en little-endian dentro del comando de carga", () => {
    const contenido = "https://ejemplo.com/s/ABC123";
    const buf = qr(contenido);

    // El comando de "almacenar datos" es GS ( k pL pH 0x31 0x50 0x30 <datos>.
    // pL/pH codifican (datos.length + 3) en little-endian.
    const nEsperado = contenido.length + 3;
    const pL = nEsperado & 0xff;
    const pH = (nEsperado >> 8) & 0xff;

    const marcador = Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]);
    const idx = buf.indexOf(marcador);

    expect(idx).toBeGreaterThanOrEqual(0);
    expect(buf.subarray(idx + marcador.length, idx + marcador.length + contenido.length)).toEqual(
      Buffer.from(contenido, "ascii"),
    );
  });

  it("incluye el comando de modelo 2 antes que cualquier otro bloque GS ( k", () => {
    const buf = qr("X");
    const modelo2 = Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    expect(buf.indexOf(modelo2)).toBe(0);
  });

  it("termina con el comando de imprimir el símbolo almacenado", () => {
    const buf = qr("X");
    const imprimir = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    expect(buf.subarray(buf.length - imprimir.length)).toEqual(imprimir);
  });

  it("un QR más largo produce un comando de carga más largo, no trunca datos", () => {
    const corto = qr("A");
    const largo = qr("A".repeat(100));
    expect(largo.length).toBeGreaterThan(corto.length);
  });
});

describe("componer()", () => {
  it("concatena los buffers en el orden dado, sin bytes de más", () => {
    const resultado = componer(inicializar(), texto("hola"), cortar());
    expect(resultado).toEqual(Buffer.concat([inicializar(), texto("hola"), cortar()]));
  });
});
