/**
 * Las etiquetas que se imprimen en la impresora térmica de la sede.
 * Hablan ZPL (Zebra y la mayoría de genéricas compatibles la
 * entienden). Si la impresora que compraron habla TSPL en vez de ZPL,
 * este es el único archivo que cambia -- ninguna pantalla ni ninguna
 * otra pieza del proyecto sabe qué lenguaje usa la impresora de
 * etiquetas.
 *
 * El logo se incrusta como gráfico ZPL (^GFA, formato ASCII hex sin
 * comprimir) a partir del mismo bitmap monocromático que ya genera
 * lib/logo-bitmap.ts para el recibo ESC/POS -- la conversión (bajar la
 * imagen, reducirla, pasarla a blanco y negro) pasa una sola vez en el
 * servidor; la estación solo traduce ese bitmap ya listo a hex, nunca
 * decodifica una imagen.
 *
 * Tamaño asumido: etiqueta de 50mm x 30mm a 203dpi (~406 x 240 dots).
 * Ajustar EL_ANCHO/EL_ALTO si el rollo comprado es de otra medida.
 */

const EL_ANCHO = 406;
const EL_ALTO = 240;

/** El marco que enmarca toda etiqueta -- un rectángulo simple, sin esquinas redondas. */
const MARCO = ["^FO5,5", `^GB${EL_ANCHO - 10},${EL_ALTO - 10},3^FS`];

export interface LogoRaster {
  anchoDots: number;
  altoDots: number;
  datosBase64: string;
}

/** ^GFA: gráfico ASCII-hex sin comprimir, un byte de origen -> dos caracteres hex. */
function imagenGfa(logo: LogoRaster): string {
  const anchoBytes = Math.ceil(logo.anchoDots / 8);
  const totalBytes = anchoBytes * logo.altoDots;
  const hex = Buffer.from(logo.datosBase64, "base64").toString("hex").toUpperCase();
  return `^GFA,${totalBytes},${totalBytes},${anchoBytes},${hex}`;
}

export interface DatosEtiquetaQr {
  nombreEmpresa: string;
  codigoEntrada: string; // ej. "PS000123" -- prefijo de la empresa + número de orden
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string; // lo que el QR codifica -- normalmente una URL con el serial
  logo?: LogoRaster | null;
}

/**
 * Arma el ZPL completo de una etiqueta. Se manda tal cual, como texto
 * plano, al puerto 9100 de la impresora -- ZPL no necesita más que eso.
 *
 * Con logo, la cabecera es la imagen y el QR/los datos bajan para
 * dejarle espacio; sin logo (todavía no lo subieron en /configuracion,
 * o no se pudo procesar), cae al nombre de la empresa en texto, como
 * antes -- nunca se manda una etiqueta con un hueco en blanco arriba.
 */
export function etiquetaQrZpl(d: DatosEtiquetaQr): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;
  const conLogo = !!d.logo;
  const yQr = conLogo ? 74 : 42;

  return [
    "^XA", // inicio de la etiqueta
    `^PW${EL_ANCHO}`,
    `^LL${EL_ALTO}`,
    ...MARCO,
    // Cabecera: el logo si hay, si no el nombre de la empresa en texto.
    ...(d.logo
      ? ["^FO18,6", imagenGfa(d.logo)]
      : ["^FO20,14", "^A0N,22,22", `^FD${d.nombreEmpresa}^FS`]),
    // El QR, debajo de la cabecera: módulo 5, corrección M.
    `^FO20,${yQr}`,
    "^BQN,2,5",
    `^FDMM,A${d.contenidoQr}^FS`,
    // El código de entrada, el dato más grande de la etiqueta.
    `^FO190,${yQr}`,
    "^A0N,36,36",
    `^FD${d.codigoEntrada}^FS`,
    // El serial del producto, más pequeño, debajo.
    `^FO190,${yQr + 46}`,
    "^A0N,24,24",
    `^FD${d.serial}^FS`,
    // Marca/modelo o tipo.
    `^FO190,${yQr + 76}`,
    "^A0N,22,22",
    `^FD${linea2}^FS`,
    // El número de orden que la generó, al pie -- útil si se despega y
    // hay que rastrear de dónde salió.
    "^FO190,195",
    "^A0N,18,18",
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

export interface DatosEtiquetaRepuesto {
  nombreEmpresa: string;
  codigo: string; // repuesto.codigo -- lo que codifica el código de barras
  descripcion: string;
  cantidadCopias: number; // una copia por unidad física recibida
  logo?: LogoRaster | null;
}

/**
 * La etiqueta de una unidad de repuesto recibida (punto 1 del documento
 * de trazabilidad del taller): código de barras en vez de QR, porque un
 * repuesto se escanea en caja como cualquier producto de estante, no se
 * abre en el navegador. `^PQ` imprime tantas copias idénticas como
 * unidades entraron en esa recepción -- un solo trabajo en la cola en
 * vez de uno por unidad.
 *
 * Con logo, la cabecera es la imagen y el código de barras baja para
 * dejarle espacio; sin logo, cae al nombre de la empresa en texto,
 * mismo criterio que etiquetaQrZpl.
 */
export function etiquetaRepuestoZpl(d: DatosEtiquetaRepuesto): string {
  const conLogo = !!d.logo;
  const yCodigo = conLogo ? 82 : 50;

  return [
    "^XA",
    `^PW${EL_ANCHO}`,
    `^LL${EL_ALTO}`,
    ...MARCO,
    ...(d.logo
      ? ["^FO18,6", imagenGfa(d.logo)]
      : ["^FO20,14", "^A0N,22,22", `^FD${d.nombreEmpresa}^FS`]),
    // El código de barras, Code128, centrado en el ancho de la etiqueta.
    `^FO20,${yCodigo}`,
    "^BY2,3,80",
    "^BCN,80,Y,N,N",
    `^FD${d.codigo}^FS`,
    // La descripción, debajo del código legible que ya imprime el ^BCN.
    `^FO20,${yCodigo + 125}`,
    "^A0N,22,22",
    `^FD${d.descripcion}^FS`,
    // Tantas copias como unidades entraron -- dentro del formato, justo
    // antes de cerrarlo, que es donde ZPL espera ^PQ.
    `^PQ${d.cantidadCopias}`,
    "^XZ",
  ].join("\n");
}
