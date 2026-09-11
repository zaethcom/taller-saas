/**
 * La etiqueta con el QR que se pega al equipo. Habla ZPL (Zebra y la
 * mayoría de genéricas compatibles la entienden). Si la impresora que
 * compraron habla TSPL en vez de ZPL, este es el único archivo que
 * cambia -- ninguna pantalla ni ninguna otra pieza del proyecto sabe
 * qué lenguaje usa la impresora de etiquetas.
 *
 * Tamaño asumido: etiqueta de 50mm x 30mm a 203dpi (~406 x 240 dots).
 * Ajustar EL_ANCHO/EL_ALTO si el rollo comprado es de otra medida.
 */

const EL_ANCHO = 406;
const EL_ALTO = 240;

export interface DatosEtiquetaQr {
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string; // lo que el QR codifica -- normalmente una URL con el serial
}

/**
 * Arma el ZPL completo de una etiqueta. Se manda tal cual, como texto
 * plano, al puerto 9100 de la impresora -- ZPL no necesita más que eso.
 */
export function etiquetaQrZpl(d: DatosEtiquetaQr): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return [
    "^XA", // inicio de la etiqueta
    `^PW${EL_ANCHO}`,
    `^LL${EL_ALTO}`,
    // El QR: módulo 5, corrección M, alineado a la izquierda.
    "^FO20,20",
    "^BQN,2,5",
    `^FDMM,A${d.contenidoQr}^FS`,
    // El serial, grande, junto al QR.
    "^FO190,30",
    "^A0N,40,40",
    `^FD${d.serial}^FS`,
    // Marca/modelo o tipo, más pequeño, debajo del serial.
    "^FO190,80",
    "^A0N,26,26",
    `^FD${linea2}^FS`,
    // El número de orden que la generó, al pie -- útil si se despega y
    // hay que rastrear de dónde salió.
    "^FO190,190",
    "^A0N,20,20",
    `^FDOrden #${d.numeroOrden}^FS`,
    "^XZ", // fin de la etiqueta, imprimir
  ].join("\n");
}

export interface DatosEtiquetaArticulo {
  codigo: string;   // "ART-000123", el mismo que se ve en la pantalla de recepción
  tipo: string;
  marca: string | null;
  modelo: string | null;
}

/**
 * La etiqueta de una unidad de mercancía (patineta, celular, accesorio
 * comprado para vender) -- a diferencia de etiquetaQrZpl, no nace de una
 * orden de reparación: no hay numeroOrden que imprimir al pie, y el QR
 * codifica el código del artículo en vez de una URL de seguimiento.
 */
export function etiquetaArticuloZpl(d: DatosEtiquetaArticulo): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return [
    "^XA",
    `^PW${EL_ANCHO}`,
    `^LL${EL_ALTO}`,
    "^FO20,20",
    "^BQN,2,5",
    `^FDMM,A${d.codigo}^FS`,
    "^FO190,30",
    "^A0N,40,40",
    `^FD${d.codigo}^FS`,
    "^FO190,80",
    "^A0N,26,26",
    `^FD${linea2}^FS`,
    "^XZ",
  ].join("\n");
}
