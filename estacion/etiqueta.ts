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
 *   PPLB CLAUDE" / P1" al puente real y salió legible en papel. Nótese
 *   que esa prueba usó el código de fuente 3 -- es el ÚNICO código de
 *   fuente confirmado en esta impresora. Una primera versión de este
 *   archivo usó los códigos 1/2/4 (sin confirmar) y las etiquetas
 *   salieron completamente en blanco (el trabajo se reportaba "OK" al
 *   puente, pero no imprimía nada) -- la fuente inválida aborta la
 *   etiqueta completa en silencio en vez de fallar visiblemente. Por
 *   eso todas las plantillas de abajo usan solo la fuente 3, variando
 *   el tamaño con los multiplicadores (que si están confirmados en
 *   1,1) en vez de con el código de fuente.
 * - El código de barras 1D (comando `B`) -- SIN CONFIRMAR todavía. El
 *   único dato real que se encontró (no de esta impresora en
 *   particular) fue un ejemplo de un manual PPLB con la forma
 *   `B<x>,<y>,<rotación>,<tipo>,<angosto>,<ancho>,<altura>,<N|R>,"<datos>"`
 *   con tipo=2 -- se usa ese valor aquí, pero si el código de barras no
 *   escanea o sale ilegible, es lo primero que hay que probar con
 *   otros valores de <tipo>.
 * - QR nativo (2D) -- CONFIRMADO: comando `b<x>,<y>,Q,s<escala>,"<datos>"`.
 *   Con el código de entrada (corto, ~8 caracteres) a escala 2 entra
 *   completo y decodifica bien. Una URL completa (~65 caracteres) a
 *   escala 3 NO entra -- se corta contra el borde físico y decodifica
 *   corrupto (ver estacion/prueba-qr-etiqueta.ts) -- por eso el QR
 *   codifica el código de entrada, no la URL de seguimiento: esta
 *   etiqueta es de 30x25mm, no hay margen para un QR de ese tamaño de
 *   contenido. El logo de la empresa tampoco entra -- se probó como
 *   bitmap PPLB (`GW`) y el resultado es una mancha ilegible a este
 *   tamaño; queda solo en el comprobante/recibo, que sí tiene espacio.
 *
 * No se manda ningún comando de tamaño de etiqueta (Q/q): la prueba
 * confirmada funcionó sin declarar nada, apoyada en la calibración que
 * ya tiene la impresora -- agregar Q/q sin saber si son mm, pulgadas o
 * puntos arriesga romper esa calibración sin necesidad.
 *
 * Rotación confirmada en 2 (180°), no 0 -- ver estacion/prueba-trazabilidad.ts.
 * Con rotación 0 el texto salió al revés en el papel real (confirmado
 * con dos etiquetas una junto a la otra en la misma tira: la de
 * rotación 0 ilegible, la de rotación 2 derecha). Es del rollo/cómo
 * queda montado en esta impresora, no de las coordenadas X/Y -- si se
 * reemplaza el rollo o la impresora, volver a confirmar con ese script
 * antes de asumir que sigue valiendo 2. El QR (comando `b`) no lleva
 * este parámetro y no lo necesita: un QR se escanea igual al derecho o
 * al revés.
 */
const ROTACION = 2;

export interface DatosEtiquetaQr {
  codigoEntrada: string; // ej. "PS000123" -- prefijo de la empresa + número de orden
}

/** PPLB usa comillas dobles como delimitador del campo de texto -- hay que escaparlas. */
function escapar(s: string): string {
  return s.replace(/"/g, "'");
}

/**
 * Arma el PPLB completo de una etiqueta. Se manda tal cual, como texto
 * plano, al puente -- PPLB no necesita más que eso.
 *
 * Solo dos campos: el QR (lo que se escanea para rastrear la orden) y
 * el mismo código de entrada en texto grande debajo, como respaldo si
 * el QR no se puede leer o hay que escribirlo a mano en /seguimiento.
 * El resto de los datos de la orden (empresa, serial, marca/modelo,
 * número de orden) ya van en el comprobante de recepción impreso al
 * mismo tiempo, que sí tiene espacio -- ver comentario de cabecera
 * sobre por qué no entran acá.
 */
export function etiquetaQrPplb(d: DatosEtiquetaQr): string {
  return [
    "N",
    `b5,5,Q,s2,"${escapar(d.codigoEntrada)}"`,
    `A5,120,${ROTACION},3,1,1,N,"${escapar(d.codigoEntrada)}"`,
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
    `A18,10,${ROTACION},3,1,1,N,"${escapar(d.codigo)}"`,
    `A18,45,${ROTACION},3,1,1,N,"${escapar(linea2)}"`,
    // Código de barras 1D con el código del artículo -- ver el aviso de
    // cabecera sobre el <tipo> sin confirmar.
    `B18,80,${ROTACION},2,3,7,60,N,"${escapar(d.codigo)}"`,
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
    `A18,10,${ROTACION},3,1,1,N,"${escapar(d.nombreEmpresa)}"`,
    // Código de barras 1D -- ver el aviso de cabecera sobre el <tipo>
    // sin confirmar (2 es el único dato real encontrado, no de esta
    // impresora en particular).
    `B18,45,${ROTACION},2,3,7,80,N,"${escapar(d.codigo)}"`,
    `A18,175,${ROTACION},3,1,1,N,"${escapar(d.descripcion)}"`,
    `P${d.cantidadCopias}`,
  ].join("\r\n");
}
