/**
 * Convierte el SVG de lib/etiquetas/diseno.ts en lo que de verdad sale
 * por la impresora: un bitmap de 1 bit (mismo formato que
 * lib/etiqueta-bitmap.ts y lib/logo-bitmap.ts, que estacion/ embebe con
 * el comando PPLB `GW` sin decodificar nada), o un PNG con esos mismos
 * píxeles para la vista previa de /configuracion -- así lo que se ve en
 * pantalla es exactamente lo que se imprime, no una aproximación en CSS.
 *
 * Si la plantilla tiene imagen de fondo propia, se baja, se ajusta a la
 * medida del sticker (cubriendo, recortando lo que sobre) y el código y
 * los textos se dibujan encima. Si la imagen no se puede bajar, la
 * etiqueta sale igual, sin fondo -- nunca se bloquea una impresión por eso.
 */
import sharp from "sharp";
import type { LogoRaster } from "../logo-bitmap";
import { disenarEtiqueta } from "./diseno";
import type { DatosEtiqueta, DisenoEtiqueta } from "./plantilla";

interface Gris {
  datos: Buffer; // 1 byte por pixel, 0 (negro) o 255 (blanco)
  anchoDots: number;
  altoDots: number;
  avisos: string[];
}

async function bajarFondo(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * El logo de la empresa, ajustado (sin deformar) a la caja que le dejó
 * el acomodo, centrado y sobre blanco. Los colores se pasan a gris: el
 * umbral de abajo los vuelve negro o blanco igual que todo lo demás.
 */
async function logoEnCaja(url: string, ancho: number, alto: number): Promise<Buffer | null> {
  const original = await bajarFondo(url);
  if (!original) return null;
  try {
    return await sharp(original)
      .flatten({ background: "#ffffff" })
      .resize(ancho, alto, { fit: "contain", background: "#ffffff" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function renderizarGris(p: DisenoEtiqueta, datos: DatosEtiqueta, girar: boolean): Promise<Gris> {
  const fondo = p.fondoUrl ? await bajarFondo(p.fondoUrl) : null;
  const { svg, anchoDots, altoDots, avisos, logo } = disenarEtiqueta(p, datos, Boolean(fondo));
  if (p.fondoUrl && !fondo) avisos.push("No se pudo cargar la imagen de fondo; la etiqueta sale sin ella.");

  const capas: sharp.OverlayOptions[] = [];
  if (fondo) capas.push({ input: Buffer.from(svg) });
  if (logo) {
    const img = await logoEnCaja(logo.url, logo.ancho, logo.alto);
    if (img) capas.push({ input: img, left: logo.x, top: logo.y });
    else avisos.push("No se pudo cargar el logo de la empresa; la etiqueta sale sin él.");
  }

  const base = fondo
    ? sharp(fondo).resize(anchoDots, altoDots, { fit: "cover" }).flatten({ background: "#ffffff" }).composite(capas)
    : sharp(Buffer.from(svg)).composite(capas);

  // Se pasa por PNG antes de girar/umbralizar: sharp aplica el composite
  // al final de la cadena, y el giro tiene que ser sobre la imagen ya compuesta.
  const compuesta = await base.resize(anchoDots, altoDots, { fit: "fill" }).png().toBuffer();
  let cadena = sharp(compuesta).flatten({ background: "#ffffff" }).greyscale();
  if (girar) cadena = cadena.rotate(180);
  const { data, info } = await cadena.threshold(160).raw().toBuffer({ resolveWithObject: true });

  return { datos: data, anchoDots: info.width, altoDots: info.height, avisos };
}

function empacar(g: Gris): LogoRaster {
  const anchoBytes = Math.ceil(g.anchoDots / 8);
  const bits = Buffer.alloc(anchoBytes * g.altoDots);
  for (let y = 0; y < g.altoDots; y++) {
    for (let x = 0; x < g.anchoDots; x++) {
      if (g.datos.readUInt8(y * g.anchoDots + x) < 128) {
        const i = y * anchoBytes + (x >> 3);
        bits.writeUInt8(bits.readUInt8(i) | (0x80 >> (x & 7)), i);
      }
    }
  }
  return { anchoDots: g.anchoDots, altoDots: g.altoDots, datosBase64: bits.toString("base64") };
}

/** El bitmap que va en la carga del trabajo de impresión (ya girado si la plantilla lo pide). */
export async function rasterEtiqueta(p: DisenoEtiqueta, datos: DatosEtiqueta): Promise<LogoRaster> {
  return empacar(await renderizarGris(p, datos, p.girar));
}

/** La vista previa: los mismos píxeles en PNG, derecho (sin el giro de impresión). */
export async function pngEtiqueta(p: DisenoEtiqueta, datos: DatosEtiqueta): Promise<{ png: Buffer; avisos: string[] }> {
  const g = await renderizarGris(p, datos, false);
  const png = await sharp(g.datos, { raw: { width: g.anchoDots, height: g.altoDots, channels: 1 } }).png().toBuffer();
  return { png, avisos: g.avisos };
}
