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
 * Quita tildes/ñ y cualquier otro carácter fuera de ASCII imprimible.
 * Probado en la T20II real: la suposición original (CP437 cubre
 * acentos "en la mayoría de impresoras de fábrica") resultó falsa para
 * este modelo -- toda tilde, la ñ, y hasta el separador "·" salieron
 * como símbolos ilegibles ("RECEPCIÓN" -> "RECEPCI[?]N"). En vez de
 * apostarle a adivinar qué página de códigos concreta necesita esta
 * impresora (varía por clon/firmware y es un problema real y conocido
 * de las térmicas genéricas chinas), se normaliza a ASCII plano antes
 * de imprimir: garantiza texto legible en cualquier impresora ESC/POS,
 * al precio de que "Recepción" salga sin la tilde.
 */
function aAscii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // separa "ó" en "o" + tilde combinada, y quita la tilde
    .replace(/[^\x00-\x7f]/g, "-"); // cualquier otro no-ASCII (ej. "·") -> guion, nunca basura
}

/** Codifica texto plano, ya normalizado a ASCII -- ver aAscii(). */
export function texto(s: string): Buffer {
  return Buffer.from(aAscii(s), "ascii");
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
 * El logo, como bitmap monocromático -- a diferencia del QR, esto sí es
 * una imagen de verdad. GS v 0 (raster bit image, modo normal): ancho
 * en BYTES (8 puntos por byte, MSB primero) y alto en puntos, seguido
 * del bitmap ya empacado a 1 bit por punto. La conversión (bajar el
 * logo, reducirlo, pasarlo a blanco y negro) pasa en el servidor
 * (lib/logo-bitmap.ts) -- la estación solo imprime bytes ya listos,
 * igual que con el resto de la carga.
 */
export function imagenRaster(anchoDots: number, altoDots: number, datos: Buffer): Buffer {
  const anchoBytes = Math.ceil(anchoDots / 8);
  const cabecera = Buffer.from([
    GS,
    0x76,
    0x30,
    0x00,
    anchoBytes & 0xff,
    (anchoBytes >> 8) & 0xff,
    altoDots & 0xff,
    (altoDots >> 8) & 0xff,
  ]);
  return Buffer.concat([cabecera, datos]);
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
