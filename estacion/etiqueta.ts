/**
 * Las etiquetas de la sede, en los dos lenguajes que pueden hacer falta.
 *
 * Arriba, ZPL, para una etiquetadora dedicada (Zebra y la mayoría de
 * genéricas compatibles lo entienden). Abajo, ESC/POS, para las sedes
 * que solo tienen la impresora de recibos -- que hoy son todas. Cuál se
 * usa lo decide la configuración de impresoras de la sede, no este
 * archivo: ver estacion/ruteo.ts.
 *
 * Si la etiquetadora que compren habla TSPL en vez de ZPL, este es el
 * único archivo que cambia -- ninguna pantalla ni ninguna otra pieza
 * del proyecto sabe qué lenguaje usa la impresora de etiquetas.
 *
 * Diseño deliberadamente de texto + primitivas nativas de ZPL (QR,
 * código de barras, caja) -- no el logo real de la empresa a color: la
 * impresora es térmica monocromática, así que un diseño gráfico como
 * el de una etiqueta comercial impresa por un tercero no se puede
 * reproducir aquí. Incrustar el logo como gráfico ZPL (^GFA, requiere
 * convertirlo a raster monocromático) queda para una fase futura, una
 * vez se pruebe esta versión en la impresora real.
 *
 * Tamaño asumido: etiqueta de 50mm x 30mm a 203dpi (~406 x 240 dots).
 * Ajustar EL_ANCHO/EL_ALTO si el rollo comprado es de otra medida.
 */

import {
  alinear,
  codigoBarras,
  componer,
  cortar,
  inicializar,
  negrita,
  qr,
  salto,
  tamano,
  texto,
} from "./escpos";

const EL_ANCHO = 406;
const EL_ALTO = 240;

/** El marco que enmarca toda etiqueta -- un rectángulo simple, sin esquinas redondas. */
const MARCO = ["^FO5,5", `^GB${EL_ANCHO - 10},${EL_ALTO - 10},3^FS`];

export interface DatosEtiquetaQr {
  nombreEmpresa: string;
  codigoEntrada: string; // ej. "PS000123" -- prefijo de la empresa + número de orden
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
    ...MARCO,
    // El nombre de la empresa, angosto, arriba del todo.
    "^FO20,14",
    "^A0N,22,22",
    `^FD${d.nombreEmpresa}^FS`,
    // El QR, debajo del nombre: módulo 5, corrección M.
    "^FO20,42",
    "^BQN,2,5",
    `^FDMM,A${d.contenidoQr}^FS`,
    // El código de entrada, el dato más grande de la etiqueta.
    "^FO190,42",
    "^A0N,36,36",
    `^FD${d.codigoEntrada}^FS`,
    // El serial del producto, más pequeño, debajo.
    "^FO190,88",
    "^A0N,24,24",
    `^FD${d.serial}^FS`,
    // Marca/modelo o tipo.
    "^FO190,118",
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
}

/**
 * La etiqueta de una unidad de repuesto recibida (punto 1 del documento
 * de trazabilidad del taller): código de barras en vez de QR, porque un
 * repuesto se escanea en caja como cualquier producto de estante, no se
 * abre en el navegador. `^PQ` imprime tantas copias idénticas como
 * unidades entraron en esa recepción -- un solo trabajo en la cola en
 * vez de uno por unidad.
 */
export function etiquetaRepuestoZpl(d: DatosEtiquetaRepuesto): string {
  return [
    "^XA",
    `^PW${EL_ANCHO}`,
    `^LL${EL_ALTO}`,
    ...MARCO,
    "^FO20,14",
    "^A0N,22,22",
    `^FD${d.nombreEmpresa}^FS`,
    // El código de barras, Code128, centrado en el ancho de la etiqueta.
    "^FO20,50",
    "^BY2,3,80",
    "^BCN,80,Y,N,N",
    `^FD${d.codigo}^FS`,
    // La descripción, debajo del código legible que ya imprime el ^BCN.
    "^FO20,175",
    "^A0N,22,22",
    `^FD${d.descripcion}^FS`,
    // Tantas copias como unidades entraron -- dentro del formato, justo
    // antes de cerrarlo, que es donde ZPL espera ^PQ.
    `^PQ${d.cantidadCopias}`,
    "^XZ",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Las mismas etiquetas, en ESC/POS, para las sedes que NO tienen
 * etiquetadora.
 *
 * Una sede con una sola impresora térmica de recibos no puede imprimir
 * ZPL: esos bytes salen como basura o no salen. Aquí la etiqueta se
 * compone como un ticket corto -- recuadro de marca, el código que
 * dibuja la propia impresora, el texto, y un corte para despegarla.
 *
 * Cuál de los dos lenguajes se usa NO lo decide este archivo sino la
 * configuración de impresoras de la sede: si hay una impresora
 * `etiquetas`, ZPL; si no, esto. Ver estacion/ruteo.ts.
 * ------------------------------------------------------------------ */

const ANCHO_MARCO = 42;

/**
 * El recuadro con el nombre de la empresa que encabeza la etiqueta --
 * el equivalente del ^GB de la versión ZPL. Cuando se imprima el logo
 * de verdad (empresa_config.logo_url, rasterizado), esta es la única
 * función que cambia.
 *
 * Sin nombre no dibuja nada: un marco vacío gasta papel y no dice nada.
 */
function cuadroMarca(nombre: string | null | undefined): Buffer[] {
  const titulo = (nombre ?? "").trim();
  if (!titulo) return [];

  const interior = ANCHO_MARCO - 4;
  const recortado = titulo.length > interior ? titulo.slice(0, interior) : titulo;
  const sobra = interior - recortado.length;
  const izquierda = " ".repeat(Math.floor(sobra / 2));
  const derecha = " ".repeat(sobra - Math.floor(sobra / 2));
  const borde = `+${"=".repeat(ANCHO_MARCO - 2)}+`;

  return [
    texto(borde),
    salto(),
    negrita(true),
    texto(`| ${izquierda}${recortado}${derecha} |`),
    salto(),
    negrita(false),
    texto(borde),
    salto(),
  ];
}

/** La etiqueta de una orden, para la impresora de tickets. */
export function etiquetaQrTicket(d: DatosEtiquetaQr): Buffer {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return componer(
    inicializar(),
    alinear("centro"),
    ...cuadroMarca(d.nombreEmpresa),
    salto(),
    qr(d.contenidoQr),
    salto(),
    // El código de entrada es lo que se lee de lejos con el equipo en
    // el estante, así que va a doble tamaño -- igual que en el ZPL, es
    // el dato más grande de la etiqueta.
    negrita(true),
    tamano(true),
    texto(d.codigoEntrada),
    tamano(false),
    negrita(false),
    salto(),
    texto(d.serial),
    salto(),
    texto(linea2),
    salto(),
    // Para rastrear de dónde salió una etiqueta despegada.
    texto(`Orden #${d.numeroOrden}`),
    salto(3),
    cortar(),
  );
}

/**
 * La etiqueta de una unidad de mercancía. No nace de una orden: no hay
 * número que imprimir al pie, y el QR codifica el código del artículo
 * en vez de una URL de seguimiento.
 */
export function etiquetaArticuloTicket(d: DatosEtiquetaArticulo): Buffer {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return componer(
    inicializar(),
    alinear("centro"),
    salto(),
    qr(d.codigo),
    salto(),
    negrita(true),
    tamano(true),
    texto(d.codigo),
    tamano(false),
    negrita(false),
    salto(),
    texto(linea2),
    salto(3),
    cortar(),
  );
}

/**
 * La etiqueta de un repuesto: código de barras, no QR, porque se
 * escanea en caja como cualquier producto de estante.
 *
 * ESC/POS no tiene el ^PQ de ZPL, así que las copias se repiten aquí:
 * una etiqueta completa, con su corte, por unidad recibida.
 */
export function etiquetaRepuestoTicket(d: DatosEtiquetaRepuesto): Buffer {
  const copias = Math.max(1, Math.trunc(d.cantidadCopias));

  const una = componer(
    inicializar(),
    alinear("centro"),
    ...cuadroMarca(d.nombreEmpresa),
    salto(),
    codigoBarras(d.codigo),
    salto(2),
    texto(d.descripcion),
    salto(3),
    cortar(),
  );

  return Buffer.concat(new Array(copias).fill(una));
}
