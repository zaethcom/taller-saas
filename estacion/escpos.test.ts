import { describe, expect, it } from "vitest";
import {
  abrirCajon,
  alinear,
  componer,
  cortar,
  imagenRaster,
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
  it("quita tildes y normaliza ñ/Ñ -- probado en la T20II real, esos bytes salían como símbolos ilegibles", () => {
    expect(texto("Ñandú")).toEqual(Buffer.from("Nandu", "ascii"));
    expect(texto("año")).toEqual(Buffer.from("ano", "ascii"));
    expect(texto("Reparación")).toEqual(Buffer.from("Reparacion", "ascii"));
  });

  it("cualquier otro carácter no-ASCII (ej. el separador ·) se reemplaza por un guion, nunca basura", () => {
    expect(texto("A · B")).toEqual(Buffer.from("A - B", "ascii"));
  });

  it("el texto ya ASCII no cambia", () => {
    expect(texto("Venta #999")).toEqual(Buffer.from("Venta #999", "ascii"));
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

describe("imagenRaster()", () => {
  it("arma la cabecera GS v 0 con ancho en bytes y alto en puntos, little-endian", () => {
    // 12 puntos de ancho -> ceil(12/8) = 2 bytes por fila; 5 puntos de alto.
    const datos = Buffer.alloc(2 * 5, 0xff);
    const buf = imagenRaster(12, 5, datos);

    const cabecera = buf.subarray(0, 8);
    expect(cabecera).toEqual(Buffer.from([0x1d, 0x76, 0x30, 0x00, 2, 0x00, 5, 0x00]));
  });

  it("adjunta los datos del bitmap tal cual, sin transformarlos", () => {
    const datos = Buffer.from([0xaa, 0x55, 0x00, 0xff]);
    const buf = imagenRaster(8, 4, datos);
    expect(buf.subarray(8)).toEqual(datos);
  });

  it("un bitmap más ancho ocupa más bytes por fila en la cabecera", () => {
    const anchoBytes = (dots: number) => imagenRaster(dots, 1, Buffer.alloc(Math.ceil(dots / 8)))[4];
    expect(anchoBytes(8)).toBe(1);
    expect(anchoBytes(9)).toBe(2); // 9 puntos ya no caben en un byte
    expect(anchoBytes(384)).toBe(48);
  });
});

describe("componer()", () => {
  it("concatena los buffers en el orden dado, sin bytes de más", () => {
    const resultado = componer(inicializar(), texto("hola"), cortar());
    expect(resultado).toEqual(Buffer.concat([inicializar(), texto("hola"), cortar()]));
  });
});
