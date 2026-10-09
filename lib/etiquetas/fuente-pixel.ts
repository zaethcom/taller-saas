/**
 * Una fuente de 5×7 puntos dibujada con rectángulos, para los textos de
 * las etiquetas. El servidor (Vercel) no tiene fuentes instaladas: un
 * `<text>` en el SVG que convierte sharp sale como cuadritos vacíos
 * (visto en papel real, Zebra ZP 500 de Local 1). Con la letra hecha de
 * rectángulos de un número entero de dots no hace falta ninguna fuente,
 * y en térmica sale nítida, sin grises que el umbral convierta en ruido.
 *
 * Solo mayúsculas, dígitos y algunos signos: las minúsculas se pasan a
 * mayúsculas y las tildes se quitan (la Ñ queda como N). Lo que no esté
 * en la tabla sale como espacio.
 */

const GLIFOS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00000", "00001", "00010", "00100", "01000", "10000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["01100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
};

const COLUMNAS = 5;
const FILAS = 7;
/** Cada letra ocupa 5 columnas más 1 de espacio. */
const PASO = COLUMNAS + 1;

/** Mayúsculas y sin tildes: lo único que sabe dibujar la tabla. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** Cuántos dots mide cada punto de la letra para un tamaño de letra dado (≈ alto de la línea). */
export function escalaDe(fuente: number): number {
  return Math.max(1, Math.round(fuente / 9));
}

/** Ancho en dots de una letra, contando su espacio. */
export function anchoPorCaracter(fuente: number): number {
  return PASO * escalaDe(fuente);
}

/** Ancho en dots del texto, sin el espacio de la última letra. */
export function anchoTexto(texto: string, fuente: number): number {
  return Math.max(0, texto.length * anchoPorCaracter(fuente) - escalaDe(fuente));
}

/**
 * El texto como un `<path>` relleno. `(x, y)`: y es la línea base (el
 * pie de las letras), como en `<text>`; con ancla "middle", x es el centro.
 * `aria-label` lleva el texto original, para leerlo en el SVG.
 */
export function textoEnPixeles(
  texto: string,
  x: number,
  y: number,
  fuente: number,
  ancla: "start" | "middle",
  negrita: boolean,
  escaparXml: (s: string) => string,
  relleno: "black" | "white" = "black",
): string {
  const s = escalaDe(fuente);
  const letras = normalizar(texto);
  const x0 = Math.round(ancla === "middle" ? x - anchoTexto(letras, fuente) / 2 : x);
  const arriba = Math.round(y) - FILAS * s;
  // Negrita: cada punto un dot más ancho hacia la derecha (cabe en el espacio entre letras).
  const extra = negrita && s >= 2 ? 1 : 0;

  let d = "";
  [...letras].forEach((letra, i) => {
    const glifo = GLIFOS[letra];
    if (!glifo) return;
    const lx = x0 + i * PASO * s;
    glifo.forEach((fila, f) => {
      // Tramos seguidos de puntos en una fila van en un solo rectángulo.
      let c = 0;
      while (c < COLUMNAS) {
        if (fila[c] !== "1") {
          c++;
          continue;
        }
        let fin = c;
        while (fin < COLUMNAS && fila[fin] === "1") fin++;
        d += `M${lx + c * s} ${arriba + f * s}h${(fin - c) * s + extra}v${s}h-${(fin - c) * s + extra}z`;
        c = fin;
      }
    });
  });

  return `<path aria-label="${escaparXml(texto)}" d="${d}" fill="${relleno}"/>`;
}
