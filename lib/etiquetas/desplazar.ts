/**
 * Corre una etiqueta ya dibujada (bitmap de 1 bit, MSB primero, 1 = negro)
 * a la derecha o a la izquierda, para compensar dónde queda el rollo bajo el
 * cabezal de la etiquetadora (ver 0066_etiquetas_ajuste.sql).
 *
 * - A la derecha: se agregan columnas blancas a la izquierda y la imagen se
 *   hace más ancha. No se recorta nada del diseño.
 * - A la izquierda: se quitan columnas de la izquierda.
 *
 * Funciona igual para PPLB, ZPL y la POS, porque cambia la imagen y no los
 * comandos de cada idioma.
 */
import type { LogoRaster } from "../logo-bitmap";

/** 203 dpi = 8 puntos por milímetro, la resolución de las etiquetadoras de las sedes. */
export const PUNTOS_POR_MM = 8;

export function desplazarRaster(raster: LogoRaster, dots: number): LogoRaster {
  const corrimiento = Math.round(dots);
  if (!corrimiento) return raster;

  const anchoViejo = raster.anchoDots;
  const anchoNuevo = Math.max(8, anchoViejo + corrimiento);
  const alto = raster.altoDots;
  const bytesViejo = Math.ceil(anchoViejo / 8);
  const bytesNuevo = Math.ceil(anchoNuevo / 8);
  const viejo = Buffer.from(raster.datosBase64, "base64");
  const nuevo = Buffer.alloc(bytesNuevo * alto);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < anchoNuevo; x++) {
      const xv = x - corrimiento; // columna de la imagen original que cae aquí
      if (xv < 0 || xv >= anchoViejo) continue;
      const negro = ((viejo[y * bytesViejo + (xv >> 3)] ?? 0) >> (7 - (xv & 7))) & 1;
      if (negro) {
        const i = y * bytesNuevo + (x >> 3);
        nuevo[i] = (nuevo[i] ?? 0) | (0x80 >> (x & 7));
      }
    }
  }

  return { anchoDots: anchoNuevo, altoDots: alto, datosBase64: nuevo.toString("base64") };
}
