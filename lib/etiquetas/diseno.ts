/**
 * Arma el SVG de una etiqueta a partir de su plantilla: dónde va el
 * código (QR o barras), los textos y el marco, a la medida del sticker
 * en dots de la impresora. Puro (sin sharp) para poder probarlo solo;
 * lib/etiquetas/renderizar.ts lo convierte después en el bitmap de 1
 * bit que imprime la estación con `GW`.
 *
 * El acomodo es automático, no se arrastra nada a mano: con el sticker
 * apaisado y QR, el QR va a la izquierda y los textos a la derecha; en
 * cualquier otro caso todo va apilado (empresa arriba, código en medio,
 * código en texto y descripción abajo). El QR y las barras se dibujan
 * con módulos de un número entero de dots -- si no, la térmica los
 * redondea distinto en cada barra y el lector no los entiende.
 */
import QRCode from "qrcode";
import { anchosCode128, modulosCode128 } from "./code128";
import { anchoPorCaracter, anchoTexto, escalaDe, textoEnPixeles } from "./fuente-pixel";
import type { DatosEtiqueta, DisenoEtiqueta } from "./plantilla";

export interface SvgEtiqueta {
  svg: string;
  anchoDots: number;
  altoDots: number;
  /** Problemas que no impiden imprimir pero que conviene ver en la vista previa. */
  avisos: string[];
}

export function mmADots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4);
}

function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Recorta un texto al ancho disponible, con la medida exacta de la letra de lib/etiquetas/fuente-pixel.ts. */
export function recortar(texto: string, anchoDots: number, fuente: number): string {
  const caben = Math.max(1, Math.floor((anchoDots + escalaDe(fuente)) / anchoPorCaracter(fuente)));
  return texto.length <= caben ? texto : `${texto.slice(0, Math.max(1, caben - 1))}.`;
}

/**
 * El código en texto nunca se recorta (es el respaldo si el código no
 * escanea): si no cabe, se achica la letra hasta que quepa.
 */
export function fuenteQueCabe(texto: string, anchoDots: number, fuente: number): number {
  let f = fuente;
  while (f > 8 && anchoTexto(texto, f) > anchoDots) f--;
  return f;
}

interface Linea {
  texto: string;
  fuente: number;
  negrita: boolean;
  /** El código en texto: se achica en vez de recortarse. */
  entero?: boolean;
}

function ajustar(l: Linea, anchoDots: number): Linea {
  return l.entero
    ? { ...l, fuente: fuenteQueCabe(l.texto, anchoDots, l.fuente) }
    : { ...l, texto: recortar(l.texto, anchoDots, l.fuente) };
}

function texto(x: number, y: number, l: Linea, ancla: "start" | "middle"): string {
  return textoEnPixeles(l.texto, x, y, l.fuente, ancla, l.negrita, escaparXml);
}

function qrSvg(contenido: string, x: number, y: number, lado: number): { svg: string; modulo: number } {
  const qr = QRCode.create(contenido, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  // El módulo se calcula dejando 2 módulos de silencio a cada lado dentro
  // de `lado`: si no, el fondo blanco de abajo se sale del área del código
  // y tapa el marco (pasaba en stickers donde el QR llena el ancho).
  const modulo = Math.max(1, Math.floor(lado / (n + 4)));
  const real = modulo * n;
  const ox = x + Math.floor((lado - real) / 2);
  const oy = y + Math.floor((lado - real) / 2);
  let d = "";
  for (let fila = 0; fila < n; fila++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(fila, col)) d += `M${ox + col * modulo} ${oy + fila * modulo}h${modulo}v${modulo}h-${modulo}z`;
    }
  }
  // Fondo blanco detrás del QR (zona de silencio) por si hay imagen de fondo.
  const margen = modulo * 2;
  return {
    svg: `<rect x="${ox - margen}" y="${oy - margen}" width="${real + margen * 2}" height="${real + margen * 2}" fill="white"/><path d="${d}" fill="black"/>`,
    modulo,
  };
}

function barrasSvg(contenido: string, x: number, y: number, ancho: number, alto: number): { svg: string; modulo: number } {
  const modulos = modulosCode128(contenido) + 20; // 10 módulos de silencio a cada lado
  const modulo = Math.max(1, Math.floor(ancho / modulos));
  const anchoReal = modulo * modulos;
  let cx = x + Math.floor((ancho - anchoReal) / 2) + modulo * 10;
  let rects = "";
  anchosCode128(contenido).forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${cx}" y="${y}" width="${w * modulo}" height="${alto}"/>`;
    cx += w * modulo;
  });
  const fondoX = x + Math.floor((ancho - anchoReal) / 2);
  return {
    svg: `<rect x="${fondoX}" y="${y}" width="${anchoReal}" height="${alto}" fill="white"/><g fill="black">${rects}</g>`,
    modulo,
  };
}

/**
 * `conFondo`: si hay imagen de fondo, el SVG va transparente (la imagen
 * se compone debajo en renderizar.ts); si no, lleva su propio blanco.
 */
export function disenarEtiqueta(p: DisenoEtiqueta, datos: DatosEtiqueta, conFondo = false): SvgEtiqueta {
  const W = mmADots(p.anchoMm, p.dpi);
  const H = mmADots(p.altoMm, p.dpi);
  const avisos: string[] = [];
  const dpmm = p.dpi / 25.4;

  const conMarco = p.campos.includes("marco");
  const trazo = Math.max(2, Math.round(0.4 * dpmm));
  const margen = Math.round(1.2 * dpmm) + (conMarco ? trazo + Math.round(0.6 * dpmm) : 0);
  const x0 = margen;
  const y0 = margen;
  const w = W - margen * 2;
  const h = H - margen * 2;
  const separacion = Math.round(0.8 * dpmm);

  // Tamaños de letra relativos al lado corto del sticker, con un mínimo
  // legible en térmica (~1.6 mm de alto) y un tope para rollos grandes.
  const corto = Math.min(W, H);
  const fuenteChica = Math.max(Math.round(1.6 * dpmm), Math.min(Math.round(corto * 0.1), Math.round(4 * dpmm)));
  const fuenteCodigo = Math.max(Math.round(2 * dpmm), Math.min(Math.round(corto * 0.13), Math.round(5.5 * dpmm)));

  const quiere = (c: string) => p.campos.includes(c as never);
  const empresa = quiere("empresa") && datos.empresa ? datos.empresa : null;
  const descripcion = quiere("descripcion") && datos.descripcion ? datos.descripcion : null;
  const textoCodigo = quiere("texto_codigo") ? datos.codigo : null;

  const partes: string[] = [];
  if (!conFondo) partes.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="white"/>`);
  if (conMarco) {
    partes.push(
      `<rect x="${trazo / 2 + 2}" y="${trazo / 2 + 2}" width="${W - trazo - 4}" height="${H - trazo - 4}" fill="none" stroke="black" stroke-width="${trazo}" rx="${Math.round(1.2 * dpmm)}"/>`,
    );
  }

  const textosLaterales: Linea[] = [];
  if (empresa) textosLaterales.push({ texto: empresa, fuente: fuenteChica, negrita: true });
  if (textoCodigo) textosLaterales.push({ texto: textoCodigo, fuente: fuenteCodigo, negrita: true, entero: true });
  if (descripcion) textosLaterales.push({ texto: descripcion, fuente: fuenteChica, negrita: false });

  const apaisadoConQr = p.codigo === "qr" && textosLaterales.length > 0 && w >= h * 1.6;
  let moduloCodigo = 0;

  if (apaisadoConQr) {
    // QR a la izquierda (del alto completo, sin pasar de la mitad del
    // ancho); textos a la derecha, centrados en vertical.
    const lado = Math.min(h, Math.floor(w * 0.5));
    const qr = qrSvg(datos.codigo, x0, y0, lado);
    moduloCodigo = qr.modulo;
    partes.push(qr.svg);
    const tx = x0 + lado + separacion * 2;
    const anchoTexto = x0 + w - tx;
    const lineas = textosLaterales.map((l) => ajustar(l, anchoTexto));
    const altoTextos = lineas.reduce((s, l) => s + l.fuente * 1.25, 0);
    let ty = y0 + Math.max(0, (h - altoTextos) / 2);
    for (const l of lineas) {
      ty += l.fuente;
      partes.push(texto(tx, Math.round(ty), l, "start"));
      ty += l.fuente * 0.25;
    }
  } else {
    // Apilado: empresa arriba; código; código en texto y descripción abajo.
    const arriba: Linea[] = empresa ? [ajustar({ texto: empresa, fuente: fuenteChica, negrita: true }, w)] : [];
    const abajo: Linea[] = [];
    if (textoCodigo) abajo.push({ texto: textoCodigo, fuente: fuenteCodigo, negrita: true, entero: true });
    if (descripcion) abajo.push({ texto: descripcion, fuente: fuenteChica, negrita: false });
    const abajoAjustado = abajo.map((l) => ajustar(l, w));

    const altoLinea = (l: Linea) => Math.round(l.fuente * 1.2);
    const altoArriba = arriba.reduce((s, l) => s + altoLinea(l), 0) + (arriba.length ? separacion : 0);
    const altoAbajo = abajoAjustado.reduce((s, l) => s + altoLinea(l), 0) + (abajoAjustado.length ? separacion : 0);
    const altoCodigo = Math.max(0, h - altoArriba - altoAbajo);

    let ty = y0;
    for (const l of arriba) {
      ty += l.fuente;
      partes.push(texto(W / 2, Math.round(ty), l, "middle"));
      ty += altoLinea(l) - l.fuente;
    }
    const yCodigo = y0 + altoArriba;

    if (p.codigo === "qr") {
      const lado = Math.min(w, altoCodigo);
      const qr = qrSvg(datos.codigo, x0 + Math.floor((w - lado) / 2), yCodigo, lado);
      moduloCodigo = qr.modulo;
      partes.push(qr.svg);
      if (lado < 21 * 2) avisos.push("No queda espacio para el QR: quite textos o use un sticker más grande.");
    } else {
      const barras = barrasSvg(datos.codigo, x0, yCodigo, w, altoCodigo);
      moduloCodigo = barras.modulo;
      partes.push(barras.svg);
      if (modulosCode128(datos.codigo) + 20 > w) {
        avisos.push("El código de barras no cabe a lo ancho: use un sticker más ancho, menos dpi, o QR.");
      }
      if (altoCodigo < Math.round(5 * dpmm)) {
        avisos.push("Las barras quedan muy bajitas (menos de 5 mm): quite textos o use un sticker más alto.");
      }
    }

    ty = yCodigo + altoCodigo + separacion;
    for (const l of abajoAjustado) {
      ty += l.fuente;
      partes.push(texto(W / 2, Math.round(ty), l, "middle"));
      ty += altoLinea(l) - l.fuente;
    }
  }

  if (p.codigo === "qr" && moduloCodigo < 2) {
    avisos.push("El QR queda con puntos muy pequeños para la impresora: puede que no escanee.");
  }

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${partes.join("")}</svg>`;
  return { svg, anchoDots: W, altoDots: H, avisos };
}
