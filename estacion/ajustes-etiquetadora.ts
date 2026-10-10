/**
 * Los ajustes de la etiquetadora que se eligen por sede en Configurar
 * impresoras (oscuridad, velocidad, sensor, corrimientos), en vez de
 * tener que cambiarlos con los botones de la impresora o una utilidad
 * del fabricante. Se mandan dentro de cada etiqueta, así que valen
 * aunque alguien reinicie o recalibre la impresora.
 *
 * Todo es opcional: lo que no se llena no se manda y la impresora sigue
 * con lo que ya tenga configurado. Por eso una sede que nunca tocó esto
 * imprime exactamente igual que antes.
 *
 * Los valores vienen de la base (jsonb que escribe cualquier admin), así
 * que se limpian aquí: un número fuera de rango se recorta y uno que no
 * es número se ignora, porque un comando mal formado puede hacer que la
 * impresora descarte la etiqueta completa sin avisar.
 */
import type { LenguajeEtiquetas } from "./destino";

export type SensorEtiquetas = "espacio" | "marca" | "continuo";

export interface AjustesEtiquetadora {
  /** 0 (más claro) a 30 (más oscuro), la escala de Zebra. En Argox se pasa a 0-15. */
  oscuridad?: number;
  /** Pulgadas por segundo, 2 a 6. Más lento suele salir más nítido. */
  velocidad?: number;
  /** Cómo detecta dónde empieza cada etiqueta. Solo Zebra. */
  sensor?: SensorEtiquetas;
  /** Corre la impresión hacia abajo (+) o hacia arriba (−), en mm. */
  verticalMm?: number;
  /** Corre la impresión hacia la derecha (+) o hacia la izquierda (−), en mm. */
  horizontalMm?: number;
  /** Cuánto más (+) o menos (−) avanza el papel al terminar, en mm. Solo Zebra. */
  corteMm?: number;
}

/** 203 dpi = 8 puntos por mm, la resolución de las etiquetadoras de las sedes. */
const PUNTOS_POR_MM = 8;

function numero(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
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
  if (e.sensor === "espacio" || e.sensor === "marca" || e.sensor === "continuo")
    a.sensor = e.sensor;
  // ±15 mm = ±120 puntos, el máximo que acepta ^LT en Zebra.
  const vertical = numero(e.verticalMm, -15, 15);
  if (vertical) a.verticalMm = vertical;
  const horizontal = numero(e.horizontalMm, -15, 15);
  if (horizontal) a.horizontalMm = horizontal;
  const corte = numero(e.corteMm, -15, 15);
  if (corte) a.corteMm = corte;
  return a;
}

const puntos = (mm: number) => Math.round(mm * PUNTOS_POR_MM);

/** Tres dígitos, con signo si es negativo, como los pide ~TA (p. ej. "016", "-008"). */
function conSigno(n: number): string {
  const abs = String(Math.abs(n)).padStart(3, "0");
  return n < 0 ? `-${abs}` : abs;
}

/**
 * Los comandos ZPL que van justo después de ^XA. Sin ningún ajuste, nada.
 * Con alguno, ^LT y ^LS van siempre (en 0 si no se llenaron): la Zebra los
 * recuerda entre etiquetas, y así borrar un corrimiento en la web también
 * lo deshace en la impresora.
 */
export function comandosZpl(a: AjustesEtiquetadora): string {
  if (Object.keys(a).length === 0) return "";
  const c: string[] = [];
  if (a.oscuridad !== undefined)
    c.push(`~SD${String(a.oscuridad).padStart(2, "0")}`);
  if (a.velocidad !== undefined)
    c.push(`^PR${a.velocidad},${a.velocidad},${a.velocidad}`);
  if (a.sensor)
    c.push(`^MN${{ espacio: "W", marca: "M", continuo: "N" }[a.sensor]}`);
  // ^LT mueve todo hacia abajo con valores positivos; ^LS mueve hacia la
  // izquierda con positivos, por eso va con el signo invertido.
  c.push(`^LT${a.verticalMm ? puntos(a.verticalMm) : 0}`);
  c.push(`^LS${a.horizontalMm ? -puntos(a.horizontalMm) : 0}`);
  if (a.corteMm !== undefined) c.push(`~TA${conSigno(puntos(a.corteMm))}`);
  return c.join("");
}

/**
 * Los comandos PPLB que van antes de `N`. Argox solo entiende oscuridad,
 * velocidad y punto de inicio (`R`, que no admite negativos).
 */
export function comandosPplb(a: AjustesEtiquetadora): string {
  const c: string[] = [];
  if (a.oscuridad !== undefined) c.push(`D${Math.round(a.oscuridad / 2)}`);
  if (a.velocidad !== undefined) c.push(`S${a.velocidad}`);
  if (a.verticalMm || a.horizontalMm) {
    c.push(
      `R${Math.max(0, puntos(a.horizontalMm ?? 0))},${Math.max(0, puntos(a.verticalMm ?? 0))}`,
    );
  }
  return c.map((l) => `${l}\r\n`).join("");
}

/**
 * Mete los ajustes en una etiqueta ya traducida. En ZPL van dentro del
 * formato (después de ^XA); en PPLB, antes de `N`. Con ajustes vacíos
 * devuelve la etiqueta tal cual.
 */
export function aplicarAjustes(
  contenido: Buffer | string,
  lenguaje: LenguajeEtiquetas,
  ajustes: AjustesEtiquetadora | undefined,
): Buffer | string {
  const a = ajustes ?? {};
  if (lenguaje === "zpl") {
    const comandos = comandosZpl(a);
    if (!comandos) return contenido;
    const texto =
      typeof contenido === "string" ? contenido : contenido.toString("utf-8");
    const i = texto.indexOf("^XA");
    if (i < 0) return contenido;
    const resultado = texto.slice(0, i + 3) + comandos + texto.slice(i + 3);
    return typeof contenido === "string"
      ? resultado
      : Buffer.from(resultado, "utf-8");
  }
  const comandos = comandosPplb(a);
  if (!comandos) return contenido;
  return typeof contenido === "string"
    ? comandos + contenido
    : Buffer.concat([Buffer.from(comandos, "ascii"), contenido]);
}
