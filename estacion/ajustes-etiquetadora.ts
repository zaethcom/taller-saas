/**
 * Los ajustes de la etiquetadora que se eligen por sede en Configurar
 * impresoras (oscuridad, velocidad, avance al terminar, sensor,
 * corrimiento vertical, giro), en vez de tener que cambiarlos con los botones de
 * la impresora o una utilidad del fabricante. Se mandan dentro de cada
 * etiqueta, así que valen aunque alguien reinicie o recalibre la impresora.
 *
 * Todo es opcional: lo que no se llena no se manda y la impresora sigue
 * con lo que ya tenga configurado. Por eso una sede que nunca tocó esto
 * imprime exactamente igual que antes.
 *
 * Los valores vienen de la base (jsonb que escribe cualquier admin), así
 * que se limpian aquí: un número fuera de rango se recorta y uno que no
 * es número se ignora, porque un comando mal formado puede hacer que la
 * impresora descarte la etiqueta completa sin avisar.
 *
 * Comandos (manual de programación ZPL II de Zebra y EPL2/PPLB de Argox):
 * - Zebra: ~SD oscuridad 00-30, ^PR velocidad en pulg/s, ~TA avance al
 *   terminar (±120 puntos), ^MN sensor, ^MT método, ^LT corrimiento vertical,
 *   ^PO giro. El corrimiento a los lados es «Correr la etiqueta» (0066), que
 *   mueve la imagen misma en lib/impresion.ts y vale para cualquier marca.
 * - Argox: D oscuridad 0-15, R punto de inicio (sin negativos), ZT/ZB giro.
 */
import type { LenguajeEtiquetas } from "./destino";

export type SensorEtiquetas = "espacio" | "marca" | "continuo";
export type MetodoImpresion = "directa" | "transferencia";

export interface AjustesEtiquetadora {
  /** 0 (más claro) a 30 (más oscuro), la escala de Zebra. En Argox se pasa a 0-15. */
  oscuridad?: number;
  /** Pulgadas por segundo, 2 a 6. Más lento suele salir más nítido. Solo Zebra. */
  velocidad?: number;
  /** Cuánto más (+) o menos (−) avanza el papel al terminar, en mm. Solo Zebra. */
  avanceMm?: number;
  /** Cómo detecta dónde empieza cada etiqueta. Solo Zebra. */
  sensor?: SensorEtiquetas;
  /** Térmica directa (sin cinta) o transferencia térmica (con cinta). Solo Zebra. */
  metodo?: MetodoImpresion;
  /** Corre la impresión hacia abajo (+) o hacia arriba (−), en mm. */
  verticalMm?: number;
  /** Imprime la etiqueta de cabeza (girada 180°). */
  girar?: boolean;
}

/** 203 dpi = 8 puntos por mm, la resolución de las etiquetadoras de las sedes. */
const PUNTOS_POR_MM = 8;

/** ±15 mm = ±120 puntos: el máximo que aceptan ~TA y ^LT en Zebra. */
const MAX_MM = 15;

function numero(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/** Lo que llega de la base o del formulario, reducido a valores que la impresora acepta. */
export function normalizarAjustes(entrada: unknown): AjustesEtiquetadora {
  if (!entrada || typeof entrada !== "object") return {};
  const e = entrada as Record<string, unknown>;
  const a: AjustesEtiquetadora = {};
  const oscuridad = numero(e.oscuridad, 0, 30);
  if (oscuridad !== undefined) a.oscuridad = Math.round(oscuridad);
  const velocidad = numero(e.velocidad, 2, 6);
  if (velocidad !== undefined) a.velocidad = Math.round(velocidad);
  const avance = numero(e.avanceMm, -MAX_MM, MAX_MM);
  if (avance) a.avanceMm = avance;
  if (e.sensor === "espacio" || e.sensor === "marca" || e.sensor === "continuo") a.sensor = e.sensor;
  if (e.metodo === "directa" || e.metodo === "transferencia") a.metodo = e.metodo;
  const vertical = numero(e.verticalMm, -MAX_MM, MAX_MM);
  if (vertical) a.verticalMm = vertical;
  if (e.girar === true) a.girar = true;
  return a;
}

const puntos = (mm: number) => Math.round(mm * PUNTOS_POR_MM);

/** Tres dígitos, con signo si es negativo, como los pide ~TA (p. ej. "040", "-016"). */
function conSigno(n: number): string {
  const abs = String(Math.abs(n)).padStart(3, "0");
  return n < 0 ? `-${abs}` : abs;
}

const LETRA_SENSOR: Record<SensorEtiquetas, string> = { espacio: "W", marca: "M", continuo: "N" };

/**
 * Los comandos ZPL que van justo después de ^XA. Sin ningún ajuste, nada.
 * Con alguno, el avance, el corrimiento y el giro van siempre (en 0 o
 * normal si no se llenaron): la Zebra los recuerda entre etiquetas hasta
 * que se apaga, y así borrar uno en la web también lo deshace en la
 * impresora.
 */
export function comandosZpl(a: AjustesEtiquetadora): string {
  if (Object.keys(a).length === 0) return "";
  const c: string[] = [];
  if (a.oscuridad !== undefined) c.push(`~SD${String(a.oscuridad).padStart(2, "0")}`);
  if (a.velocidad !== undefined) c.push(`^PR${a.velocidad},${a.velocidad},${a.velocidad}`);
  if (a.sensor) c.push(`^MN${LETRA_SENSOR[a.sensor]}`);
  if (a.metodo) c.push(`^MT${a.metodo === "transferencia" ? "T" : "D"}`);
  c.push(`~TA${conSigno(a.avanceMm ? puntos(a.avanceMm) : 0)}`);
  // ^LT mueve todo hacia abajo con valores positivos.
  c.push(`^LT${a.verticalMm ? puntos(a.verticalMm) : 0}`);
  c.push(a.girar ? "^POI" : "^PON");
  return c.join("");
}

/**
 * Los comandos PPLB que van antes de `N`. De lo que se puede elegir, Argox
 * solo entiende oscuridad, punto de inicio (`R`, que no admite negativos)
 * y giro (ZB = de cabeza, ZT = normal).
 */
export function comandosPplb(a: AjustesEtiquetadora): string {
  if (Object.keys(a).length === 0) return "";
  const c: string[] = [];
  if (a.oscuridad !== undefined) c.push(`D${Math.round(a.oscuridad / 2)}`);
  if (a.verticalMm && a.verticalMm > 0) c.push(`R0,${puntos(a.verticalMm)}`);
  c.push(a.girar ? "ZB" : "ZT");
  return c.map((l) => `${l}\r\n`).join("");
}

/**
 * Mete los ajustes en una etiqueta ya traducida. En ZPL van dentro del
 * formato (después de ^XA); en PPLB, antes de `N`. La POS de tickets
 * (escpos) no tiene estos ajustes. Con ajustes vacíos devuelve la
 * etiqueta tal cual.
 */
export function aplicarAjustes(
  contenido: Buffer | string,
  lenguaje: LenguajeEtiquetas,
  ajustes: AjustesEtiquetadora | undefined,
): Buffer | string {
  const a = ajustes ?? {};
  if (lenguaje === "escpos") return contenido;
  if (lenguaje === "zpl") {
    const comandos = comandosZpl(a);
    if (!comandos) return contenido;
    const texto = typeof contenido === "string" ? contenido : contenido.toString("utf-8");
    const i = texto.indexOf("^XA");
    if (i < 0) return contenido;
    const resultado = texto.slice(0, i + 3) + comandos + texto.slice(i + 3);
    return typeof contenido === "string" ? resultado : Buffer.from(resultado, "utf-8");
  }
  const comandos = comandosPplb(a);
  if (!comandos) return contenido;
  return typeof contenido === "string"
    ? comandos + contenido
    : Buffer.concat([Buffer.from(comandos, "ascii"), contenido]);
}
