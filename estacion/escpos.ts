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

/**
 * ESC 3 n -- distancia entre renglones, en puntos. El valor de fábrica
 * (1/6 de pulgada, ~30 puntos) deja aire de sobra sobre la fuente A de
 * 24 puntos; los recibos usan INTERLINEADO_COMPACTO para gastar menos
 * papel sin que las letras se toquen.
 */
export function interlineado(puntos: number): Buffer {
  return Buffer.from([ESC, 0x33, Math.max(0, Math.min(255, Math.round(puntos)))]);
}

export const INTERLINEADO_COMPACTO = 26;

/**
 * Caracteres por renglón de la fuente A en papel de 80mm, dentro del área
 * de [areaImpresion]. Antes eran 48, el máximo de una Epson de 576 puntos,
 * pero la Sewoo de Polaco Scooter solo tiene 512 puntos útiles (42 letras):
 * el monto de cada ítem y la raya separadora se partían al renglón siguiente
 * y el texto quedaba pegado a los bordes. 40 letras más un margen caben en
 * cualquier impresora de 80mm.
 */
export const COLUMNAS_TICKET = 40;

/** Margen izquierdo y ancho del área de impresión en papel de 80mm, en puntos. */
const MARGEN_80_DOTS = 16;
const AREA_80_DOTS = COLUMNAS_TICKET * 12; // fuente A: 12 puntos por letra

/**
 * GS L + GS W: deja un margen a la izquierda y limita el renglón a
 * COLUMNAS_TICKET letras, para que nada quede pegado al borde del papel.
 * Va al principio del ticket (después de ESC @, que lo resetea). En 58mm no
 * hace nada: ese rollo ya se calcula con sus 32 letras de siempre.
 */
export function areaImpresion(anchoMm?: number | null): Buffer {
  if (anchoMm === 58) return Buffer.alloc(0);
  return Buffer.from([
    GS, 0x4c, MARGEN_80_DOTS & 0xff, (MARGEN_80_DOTS >> 8) & 0xff,
    GS, 0x57, AREA_80_DOTS & 0xff, (AREA_80_DOTS >> 8) & 0xff,
  ]);
}

/** Caracteres por renglón de la fuente A según el ancho del rollo (58mm = 32). */
export function columnasPapel(anchoMm?: number | null): number {
  return anchoMm === 58 ? 32 : COLUMNAS_TICKET;
}

/**
 * Parte un texto en renglones de `columnas` letras sin cortar palabras
 * (una palabra más larga que el renglón sí se corta). La impresora
 * parte sola, pero a mitad de palabra: "pantal" / "la".
 */
export function ajustar(s: string, columnas: number): string[] {
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of s.split(/\s+/).filter(Boolean)) {
    let resto = palabra;
    while (resto.length > columnas) {
      if (actual) {
        renglones.push(actual);
        actual = "";
      }
      renglones.push(resto.slice(0, columnas));
      resto = resto.slice(columnas);
    }
    if (!resto) continue;
    if (!actual) actual = resto;
    else if (actual.length + 1 + resto.length <= columnas) actual += " " + resto;
    else {
      renglones.push(actual);
      actual = resto;
    }
  }
  if (actual) renglones.push(actual);
  return renglones;
}

/** Une datos con " - " mientras quepan en el renglón; si no, el siguiente va abajo. */
export function juntar(datos: string[], columnas: number): string[] {
  const renglones: string[] = [];
  for (const dato of datos.filter(Boolean)) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo !== undefined && ultimo.length + 3 + dato.length <= columnas) {
      renglones[renglones.length - 1] = `${ultimo} - ${dato}`;
    } else {
      renglones.push(...ajustar(dato, columnas));
    }
  }
  return renglones;
}

/** Cada renglón de ajustar()/juntar() como texto + salto. */
export function renglones(lineas: string[]): Buffer[] {
  return lineas.flatMap((l) => [texto(l), salto()]);
}

/**
 * Texto a la izquierda y monto a la derecha en el mismo renglón, con
 * espacios en medio. null si no caben juntos: quien llama lo parte en
 * dos renglones.
 */
export function dosColumnas(izq: string, der: string, ancho = COLUMNAS_TICKET): string | null {
  const espacio = ancho - izq.length - der.length;
  return espacio >= 1 ? izq + " ".repeat(espacio) + der : null;
}

/**
 * GS ! n -- solo doble alto (0x01): letra más grande y legible sin perder
 * letras por renglón. Para los ítems del recibo.
 */
export function altoDoble(activo: boolean): Buffer {
  return Buffer.from([GS, 0x21, activo ? 0x01 : 0x00]);
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
 *
 * SIN USO en producción -- confirmado en hardware real (Perto/PERTO
 * Printer TEC) que ese modelo no interpreta este comando: los bytes de
 * control se pierden y los bytes imprimibles de la secuencia salen
 * como texto literal en el papel. El comprobante de recepción usa
 * lib/qr-bitmap.ts (imagen, como el logo) en vez de esto -- se deja
 * esta función y su prueba porque el comando es correcto según el
 * estándar y puede servir en otra impresora que sí lo soporte.
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

/**
 * Pitido del buzzer integrado al terminar de imprimir, como en las
 * comanderas de cocina. `ESC 07 n1 n2 n3`: n1 = tiempo encendido, n2 =
 * tiempo apagado (unidad: 100ms cada uno, 0-255), n3 = cantidad de
 * pitidos (1-9). NO es un comando ESC/POS estándar de Epson -- la
 * TM-T20II genuina no trae buzzer de fábrica; este es el comando que
 * documentan los clones chinos genéricos (Xprinter/Zjiang/Gainscha)
 * que suele traer esta familia de impresoras económicas. SIN CONFIRMAR
 * todavía contra el hardware real -- ver estacion/prueba-pitido.ts. Si
 * la impresora real no tiene buzzer o no entiende este comando, lo más
 * probable es que lo ignore en silencio (mismo comportamiento que ya
 * se documentó para otros comandos no soportados en escpos.ts).
 */
export function pitido(veces = 1, onMs = 200, offMs = 200): Buffer {
  const n1 = Math.max(0, Math.min(255, Math.round(onMs / 100)));
  const n2 = Math.max(0, Math.min(255, Math.round(offMs / 100)));
  const n3 = Math.max(1, Math.min(9, veces)); // el comando documentado limita 1-9
  return Buffer.from([ESC, 0x07, n1, n2, n3]);
}

/** Concatena una secuencia de comandos en un solo buffer para enviar de una vez. */
export function componer(...partes: Buffer[]): Buffer {
  return Buffer.concat(partes);
}
