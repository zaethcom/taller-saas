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
 *   completo y decodifica bien. El logo de la empresa NO entra como
 *   bitmap PPLB (`GW`) a este tamaño -- se probó y el resultado es una
 *   mancha ilegible; queda solo en el comprobante/recibo.
 *
 * No se manda ningún comando de tamaño de etiqueta (Q/q): la prueba
 * confirmada funcionó sin declarar nada, apoyada en la calibración que
 * ya tiene la impresora -- agregar Q/q sin saber si son mm, pulgadas o
 * puntos arriesga romper esa calibración sin necesidad.
 *
 * Rotación confirmada en 2 (180°), no 0, PARA COMANDOS DE TEXTO/QR
 * NATIVOS (`A`/`b`) -- ver estacion/prueba-trazabilidad.ts.
 *
 * ETIQUETA_QR YA NO USA ESOS COMANDOS NATIVOS. Se cambió a renderizar
 * todo (QR + código + marco) como una sola imagen en el servidor
 * (lib/etiqueta-bitmap.ts, mismo principio que
 * com.smartfoodlabel.app...DulganiLabelRenderer: dibujar el diseño
 * completo como bitmap, la impresora solo reproduce píxeles) y mandarla
 * con el comando de gráfico PPLB `GW` -- confirmado que el comando
 * funciona en esta impresora (se probó con el logo, que salió mancha
 * por resolución, no porque `GW` fallara), pero el combo QR+código+marco
 * concreto de etiquetaQrPplb() todavía NO se probó en papel real -- ver
 * estacion/prueba-trazabilidad.ts para la próxima ronda. `GW` no tiene
 * parámetro de rotación (a diferencia de `A`/`b`): si sale al revés,
 * hay que rotar la imagen 180° en lib/etiqueta-bitmap.ts (sharp lo hace
 * con .rotate(180), trivial) en vez de tocar nada acá.
 *
 * etiquetaArticuloPplb/etiquetaRepuestoPplb siguen con los comandos
 * nativos `A`/`B` (rotación 2) -- no se tocaron, ya confirmados en
 * hardware real.
 */
const ROTACION = 2;

/** Mismo shape que lib/logo-bitmap.ts::LogoRaster -- duplicado a propósito,
 *  igual que ya hace estacion/marca.ts::LogoRaster: estacion/ nunca importa
 *  de lib/ (esa carpeta usa `sharp`, con binarios nativos que no queremos
 *  arrastrar a Android/Termux). */
export interface EtiquetaRaster {
  anchoDots: number;
  altoDots: number;
  datosBase64: string;
}

export interface DatosEtiquetaQr {
  etiquetaRaster: EtiquetaRaster; // QR + código + marco, ya renderizados -- ver lib/etiqueta-bitmap.ts
}

/** PPLB usa comillas dobles como delimitador del campo de texto -- hay que escaparlas. */
function escapar(s: string): string {
  return s.replace(/"/g, "'");
}

/**
 * `GW<x>,<y>,<ancho en BYTES>,<alto en dots>,<datos binarios>` -- a
 * diferencia de los campos de texto, esto va como bytes crudos, no
 * como texto ASCII, por eso el resultado es un Buffer y no un string.
 */
function imagenGw(x: number, y: number, raster: EtiquetaRaster): Buffer {
  const anchoBytes = Math.ceil(raster.anchoDots / 8);
  const datos = Buffer.from(raster.datosBase64, "base64");
  const encabezado = Buffer.from(`GW${x},${y},${anchoBytes},${raster.altoDots},`, "ascii");
  return Buffer.concat([encabezado, datos]);
}

/**
 * La etiqueta de una orden: una sola imagen (QR + código + marco, ya
 * renderizada en el servidor) embebida con el comando de gráfico PPLB
 * `GW` -- ver el comentario de cabecera sobre por qué se dejaron de
 * usar los comandos de texto/QR nativos para esta etiqueta en
 * particular.
 */
export function etiquetaQrPplb(d: DatosEtiquetaQr): Buffer {
  return Buffer.concat([
    Buffer.from("N\r\n", "ascii"),
    imagenGw(0, 0, d.etiquetaRaster),
    Buffer.from("\r\nP1\r\n", "ascii"),
  ]);
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
