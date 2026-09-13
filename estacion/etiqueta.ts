/**
 * La etiqueta que se pega al equipo o al artículo.
 *
 * Se imprime en la MISMA impresora de tickets (Epson TM-T20II y
 * compatibles), no en una etiquetadora aparte: la sede tiene una sola
 * impresora y comprar una segunda para pegar un QR no se justifica. Por
 * eso lo que sale de aquí es ESC/POS, igual que un recibo, y no ZPL.
 *
 * Se sigue emitiendo ZPL para el caso de que algún día haya una
 * etiquetadora de verdad -- `etiquetaQrZpl` y `etiquetaArticuloZpl` más
 * abajo. Cuál de los dos se usa lo decide `config.json`: si no hay
 * impresora `etiquetas` configurada, la etiqueta sale por la de tickets.
 * Ver `resolverImpresion` en index.ts.
 */
import {
  alinear,
  componer,
  cortar,
  inicializar,
  negrita,
  qr,
  salto,
  tamano,
  texto,
} from "./escpos";

/**
 * Caracteres útiles por línea en papel de 80mm con la fuente A. Las
 * impresoras dan 48, pero el marco se deja más angosto: la etiqueta se
 * arranca a mano y los bordes del papel rara vez quedan rectos.
 */
const ANCHO_MARCO = 42;

/**
 * El recuadro con el nombre de la empresa que encabeza la etiqueta --
 * el lugar donde va la marca. Hoy es el nombre en texto; cuando se
 * imprima el logo de verdad (empresa_config.logo_url) va exactamente
 * aquí, y esta es la única función que cambia.
 *
 * Sin nombre no dibuja nada: un marco vacío gasta papel y no dice nada.
 * Pasa con los trabajos encolados antes de que las etiquetas llevaran
 * marca, que siguen en la cola y tienen que imprimir igual.
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

export interface DatosEtiquetaQr {
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string; // lo que el QR codifica -- normalmente una URL con el serial
  /**
   * El nombre de la empresa, que encolarImpresion() agrega solo. Es
   * opcional porque los trabajos que ya estaban en la cola antes de
   * este cambio no lo traen.
   */
  empresaNombre?: string | null;
}

/**
 * La etiqueta de una orden, en ESC/POS, para la impresora de tickets.
 * La imprime la misma impresora que el comprobante, así que sale
 * cortada y lista para pegar en el equipo.
 */
export function etiquetaQrTicket(d: DatosEtiquetaQr): Buffer {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return componer(
    inicializar(),
    alinear("centro"),
    ...cuadroMarca(d.empresaNombre),
    salto(),
    qr(d.contenidoQr),
    salto(),
    // El serial es lo que se lee de lejos cuando el equipo está en el
    // estante, así que va a doble tamaño.
    negrita(true),
    tamano(true),
    texto(d.serial),
    tamano(false),
    negrita(false),
    salto(),
    texto(linea2),
    salto(),
    // El número de orden permite rastrear de dónde salió la etiqueta si
    // se despega del equipo.
    texto(`Orden #${d.numeroOrden}`),
    salto(3),
    cortar(),
  );
}

export interface DatosEtiquetaArticulo {
  codigo: string;   // "ART-000123", el mismo que se ve en la pantalla de recepción
  tipo: string;
  marca: string | null;
  modelo: string | null;
  empresaNombre?: string | null;
}

/**
 * La etiqueta de una unidad de mercancía (patineta, celular, accesorio
 * comprado para vender) -- a diferencia de etiquetaQrTicket, no nace de
 * una orden de reparación: no hay numeroOrden que imprimir al pie, y el
 * QR codifica el código del artículo en vez de una URL de seguimiento.
 */
export function etiquetaArticuloTicket(d: DatosEtiquetaArticulo): Buffer {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return componer(
    inicializar(),
    alinear("centro"),
    ...cuadroMarca(d.empresaNombre),
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
 * Tamaño asumido por las dos funciones ZPL de abajo: etiqueta de
 * 50mm x 30mm a 203dpi (~406 x 240 dots).
 */
const EL_ANCHO = 406;
const EL_ALTO = 240;

/**
 * La misma etiqueta en ZPL, para una etiquetadora dedicada. Hoy no se
 * usa en ninguna sede -- queda porque el puente ya sabe atender una
 * segunda impresora en el 9101 y volver atrás no debería costar
 * reescribir esto.
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
    "^FO190,190",
    "^A0N,20,20",
    `^FDOrden #${d.numeroOrden}^FS`,
    "^XZ", // fin de la etiqueta, imprimir
  ].join("\n");
}

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
