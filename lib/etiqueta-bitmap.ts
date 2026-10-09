/**
 * La etiqueta de una orden (QR + código de entrada, con marco) cuando la
 * empresa no tiene plantilla activa para "orden" en /configuracion. Se
 * dibuja con el mismo diseñador que las plantillas (lib/etiquetas/), con
 * el modelo de fábrica de 30x25mm, y sale como una sola imagen de 1 bit
 * que estacion/ embebe tal cual (PPLB `GW` o ZPL `^GFA`).
 *
 * Antes esto tenía su propio SVG, con el QR insertado sin tamaño: salía
 * de 210 dots en vez de 140, se salía del marco y tapaba el código en
 * texto -- en papel (Zebra ZP 500, Local 1) el QR quedaba cortado y no
 * escaneaba. Ahora el QR va con módulos de un número entero de dots y la
 * letra no depende de fuentes del servidor (ver lib/etiquetas/fuente-pixel.ts).
 */
import type { LogoRaster } from "./logo-bitmap";
import { MODELOS } from "./etiquetas/plantilla";
import { rasterEtiqueta } from "./etiquetas/renderizar";

const MODELO_ORDEN = MODELOS.find((m) => m.id === "orden-30x25")!.diseno;

export async function generarEtiquetaQrRaster(codigoEntrada: string): Promise<LogoRaster> {
  return rasterEtiqueta({ ...MODELO_ORDEN, fondoUrl: null, girar: false }, { codigo: codigoEntrada });
}
