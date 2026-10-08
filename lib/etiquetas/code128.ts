/**
 * Código de barras Code 128 (juego B: letras, números y signos ASCII
 * imprimibles), escrito a mano en vez de con una librería: es una tabla
 * y una suma de control, y lo que se necesita es el ancho de cada barra
 * para dibujarla en el SVG de la etiqueta (lib/etiquetas/diseno.ts) a
 * un número entero de dots, que es lo que hace que una térmica la
 * imprima nítida y se pueda escanear.
 *
 * Cada patrón son 6 anchos (barra, espacio, barra, espacio, barra,
 * espacio) en módulos, que suman 11; el de parada tiene una barra más
 * y suma 13.
 */
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

export const PATRONES_CODE128 = PATRONES;

const INICIO_B = 104;
const PARADA = 106;

/** Solo ASCII imprimible (32-126) entra en el juego B. */
export function codificableCode128(texto: string): boolean {
  return texto.length > 0 && [...texto].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);
}

/**
 * Los anchos de barras y espacios alternados (empezando por barra) en
 * módulos, de inicio a parada, sin zona de silencio. Los caracteres que
 * no son ASCII imprimible se reemplazan por "?" en vez de fallar.
 */
export function anchosCode128(texto: string): number[] {
  const valores = [...texto].map((c) => {
    const codigo = c.charCodeAt(0);
    return codigo >= 32 && codigo <= 126 ? codigo - 32 : "?".charCodeAt(0) - 32;
  });
  const control = valores.reduce((suma, v, i) => suma + v * (i + 1), INICIO_B) % 103;
  const simbolos = [INICIO_B, ...valores, control, PARADA];
  return simbolos.flatMap((s) => [...(PATRONES[s] ?? "")].map(Number));
}

/** Módulos totales (sin zona de silencio): 11 por símbolo + 13 de la parada. */
export function modulosCode128(texto: string): number {
  return 11 * ([...texto].length + 2) + 13;
}
