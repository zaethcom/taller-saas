/**
 * Los bytes ESC/POS para la impresora de tickets: texto, corte y el
 * pulso que abre el cajón monedero.
 *
 * Esto es lo único en todo el proyecto que sabe que existe un byte 0x1B.
 * La web nunca construye estos buffers -- solo encola una carga con
 * texto y números ya resueltos (ver lib/impresion.ts), y estacion/
 * la traduce a esto.
 *
 * Referencia: la mayoría de impresoras de 80mm (Epson TM-T20, Star
 * TSP143 y las genéricas chinas) entienden este subconjunto de ESC/POS.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function inicializar(): Buffer {
  // ESC @ : resetea la impresora a su estado por defecto.
  return Buffer.from([ESC, 0x40]);
}

/**
 * Codifica texto plano. CP437 cubre acentos y ñ en la mayoría de
 * impresoras térmicas de 80mm configuradas de fábrica; si una impresora
 * concreta usa otra página de códigos, ajustar aquí -- es la única
 * función que necesita saberlo.
 */
export function texto(s: string): Buffer {
  return Buffer.from(s, "latin1");
}

export function salto(lineas = 1): Buffer {
  return Buffer.from(new Array(lineas).fill(LF));
}

export function negrita(activa: boolean): Buffer {
  // ESC E n
  return Buffer.from([ESC, 0x45, activa ? 1 : 0]);
}

export type Alineacion = "izquierda" | "centro" | "derecha";

export function alinear(a: Alineacion): Buffer {
  // ESC a n
  const n = a === "izquierda" ? 0 : a === "centro" ? 1 : 2;
  return Buffer.from([ESC, 0x61, n]);
}

export function tamano(doble: boolean): Buffer {
  // GS ! n -- 0x11 = doble ancho y doble alto a la vez.
  return Buffer.from([GS, 0x21, doble ? 0x11 : 0x00]);
}

/** ESC p 0 25 250 -- pulso al pin 2 del conector RJ11. Abre el cajón. */
export function abrirCajon(): Buffer {
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

/** GS V 66 0 -- corte parcial: deja una pestaña para arrancar a mano. */
export function cortar(): Buffer {
  return Buffer.from([GS, 0x56, 0x42, 0x00]);
}

/**
 * La impresora dibuja el QR sola: nunca se le manda una imagen.
 * Secuencia estándar GS ( k para módulo QR (Epson y compatibles):
 * modelo 2, tamaño de módulo 8, corrección de errores M, cargar los
 * datos, e imprimir el símbolo almacenado.
 */
export function qr(contenido: string): Buffer {
  const datos = Buffer.from(contenido, "ascii");
  const n = datos.length + 3;

  return Buffer.concat([
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // modelo 2
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x08]), // tamaño de módulo 8
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // corrección M
    Buffer.from([GS, 0x28, 0x6b, n & 0xff, (n >> 8) & 0xff, 0x31, 0x50, 0x30]),
    datos,
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), // imprimir el símbolo
  ]);
}

/** Concatena una secuencia de comandos en un solo buffer para enviar de una vez. */
export function componer(...partes: Buffer[]): Buffer {
  return Buffer.concat(partes);
}

/**
 * Un código de barras Code128 que dibuja la propia impresora, igual que
 * el QR: nunca se le manda una imagen.
 *
 * GS h fija la altura en puntos, GS w el ancho de módulo, GS H 2 pone
 * el número legible debajo de las barras -- sin eso, un código que no
 * escanea no se puede teclear a mano. El "{B" delante de los datos
 * selecciona el juego de caracteres B (alfanumérico), que es lo que
 * usan los códigos de repuesto.
 */
export function codigoBarras(contenido: string, altura = 80): Buffer {
  const datos = Buffer.from(`{B${contenido}`, "ascii");

  return Buffer.concat([
    Buffer.from([GS, 0x68, altura]), // GS h -- altura
    Buffer.from([GS, 0x77, 0x02]), // GS w -- ancho de módulo
    Buffer.from([GS, 0x48, 0x02]), // GS H -- número legible debajo
    Buffer.from([GS, 0x6b, 0x49, datos.length]), // GS k 73 n -- Code128
    datos,
  ]);
}
