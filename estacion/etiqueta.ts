/**
 * Las etiquetas que se imprimen en la impresora térmica de la sede.
 * Hablan PPLB (Argox SAT-TT448USP real, confirmado contra el
 * dispositivo -- ver estacion/prueba-pplb.ts). Si la sede compra otra
 * impresora que hable ZPL/EPL/TSPL, este es el único archivo que
 * cambia -- ninguna pantalla ni ninguna otra pieza del proyecto sabe
 * qué lenguaje usa la impresora de etiquetas.
 *
 * Qué está confirmado en hardware real y qué no:
 * - `N` (limpiar buffer), el comando de texto `A` y `P<n>` (imprimir
 *   copias) -- CONFIRMADO: se mandó "N / A50,50,0,3,1,1,N,"PRUEBA
 *   PPLB CLAUDE" / P1" al puente real y salió legible en papel.
 * - El código de barras 1D (comando `B`) -- SIN CONFIRMAR todavía. El
 *   único dato real que se encontró (no de esta impresora en
 *   particular) fue un ejemplo de un manual PPLB con la forma
 *   `B<x>,<y>,<rotación>,<tipo>,<angosto>,<ancho>,<altura>,<N|R>,"<datos>"`
 *   con tipo=2 -- se usa ese valor aquí, pero si el código de barras no
 *   escanea o sale ilegible, es lo primero que hay que probar con
 *   otros valores de <tipo>.
 * - QR nativo (2D) -- deliberadamente NO se intenta todavía: no hay
 *   ninguna referencia confiable de qué comando usa PPLB para 2D en
 *   esta impresora, y un comando 2D mal armado podría cortar el resto
 *   de la etiqueta en vez de solo fallar ese campo (a diferencia de
 *   ZPL/ESC-POS, no está confirmado qué tan tolerante es esta
 *   impresora a un comando que no reconoce). Mientras tanto, el código
 *   de entrada grande en texto es el identificador -- se puede escribir
 *   a mano en /seguimiento si hace falta. Agregar el QR real es el
 *   siguiente paso, apenas se pueda probar en el Sion otra vez.
 *
 * No se manda ningún comando de tamaño de etiqueta (Q/q): la prueba
 * confirmada funcionó sin declarar nada, apoyada en la calibración que
 * ya tiene la impresora -- agregar Q/q sin saber si son mm, pulgadas o
 * puntos arriesga romper esa calibración sin necesidad.
 */

export interface DatosEtiquetaQr {
  nombreEmpresa: string;
  codigoEntrada: string; // ej. "PS000123" -- prefijo de la empresa + número de orden
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string; // pendiente de imprimir como QR real -- ver comentario de cabecera
}

/** PPLB usa comillas dobles como delimitador del campo de texto -- hay que escaparlas. */
function escapar(s: string): string {
  return s.replace(/"/g, "'");
}

/**
 * Arma el PPLB completo de una etiqueta. Se manda tal cual, como texto
 * plano, al puente -- PPLB no necesita más que eso.
 */
export function etiquetaQrPplb(d: DatosEtiquetaQr): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return [
    "N",
    `A18,10,0,2,1,1,N,"${escapar(d.nombreEmpresa)}"`,
    `A18,45,0,4,1,1,N,"${escapar(d.codigoEntrada)}"`,
    `A18,90,0,2,1,1,N,"${escapar(d.serial)}"`,
    `A18,120,0,2,1,1,N,"${escapar(linea2)}"`,
    `A18,150,0,1,1,1,N,"${escapar(d.contenidoQr)}"`,
    `A18,195,0,1,1,1,N,"Orden #${d.numeroOrden}"`,
    "P1",
  ].join("\r\n");
}

export interface DatosEtiquetaArticulo {
  codigo: string; // "ART-000123", el mismo que se ve en la pantalla de recepción
  tipo: string;
  marca: string | null;
  modelo: string | null;
}

/**
 * La etiqueta de una unidad de mercancía (patineta, celular, accesorio
 * comprado para vender) -- a diferencia de etiquetaQrPplb, no nace de
 * una orden de reparación.
 */
export function etiquetaArticuloPplb(d: DatosEtiquetaArticulo): string {
  const linea2 = [d.marca, d.modelo].filter(Boolean).join(" ") || d.tipo;

  return [
    "N",
    `A18,10,0,4,1,1,N,"${escapar(d.codigo)}"`,
    `A18,55,0,2,1,1,N,"${escapar(linea2)}"`,
    // Código de barras 1D con el código del artículo -- ver el aviso de
    // cabecera sobre el <tipo> sin confirmar.
    `B18,95,0,2,3,7,60,N,"${escapar(d.codigo)}"`,
    "P1",
  ].join("\r\n");
}

export interface DatosEtiquetaRepuesto {
  nombreEmpresa: string;
  codigo: string; // repuesto.codigo -- lo que codifica el código de barras
  descripcion: string;
  cantidadCopias: number; // una copia por unidad física recibida
}

/**
 * La etiqueta de una unidad de repuesto recibida (punto 1 del documento
 * de trazabilidad del taller). `P<n>` imprime tantas copias idénticas
 * como unidades entraron en esa recepción -- un solo trabajo en la
 * cola en vez de uno por unidad.
 */
export function etiquetaRepuestoPplb(d: DatosEtiquetaRepuesto): string {
  return [
    "N",
    `A18,10,0,2,1,1,N,"${escapar(d.nombreEmpresa)}"`,
    // Código de barras 1D -- ver el aviso de cabecera sobre el <tipo>
    // sin confirmar (2 es el único dato real encontrado, no de esta
    // impresora en particular).
    `B18,45,0,2,3,7,80,N,"${escapar(d.codigo)}"`,
    `A18,175,0,2,1,1,N,"${escapar(d.descripcion)}"`,
    `P${d.cantidadCopias}`,
  ].join("\r\n");
}
