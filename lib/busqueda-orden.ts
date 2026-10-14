/**
 * Las reglas del buscador de la barra superior, separadas de la ruta
 * (/api/ordenes/busqueda) para poder probarlas sin base de datos.
 *
 * Lo que se escribe puede ser un número de orden, un código de entrada
 * de la etiqueta, un serial, el documento del cliente o uno de los dos
 * teléfonos (el del cliente y el alterno de la orden). Teléfonos y
 * documentos se guardan como los escribió quien recibió el equipo
 * ("300 123 4567", "+57 300-123-4567", "1.023.456.789"), así que se
 * comparan solo por sus dígitos/letras, nunca por el texto tal cual.
 */

/** Menos dígitos que esto no se buscan como teléfono: "14" es una orden. */
export const MIN_DIGITOS_TELEFONO = 7;
/** Menos caracteres que esto no se buscan como documento. */
export const MIN_CARACTERES_DOCUMENTO = 5;

export type Coincidencia = "numero" | "serial" | "documento" | "telefono" | "telefono_alterno";

export const ETIQUETA_COINCIDENCIA: Record<Coincidencia, string> = {
  numero: "Número de orden",
  serial: "Serial",
  documento: "Documento",
  telefono: "Teléfono",
  telefono_alterno: "Teléfono alterno",
};

export function soloDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

/** Letras y dígitos en mayúscula: "1.023.456-7" y "10234567" son el mismo documento. */
export function normalizarDocumento(texto: string | null | undefined): string {
  return (texto ?? "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

/**
 * Los dígitos de un teléfono buscado, sin el indicativo de Colombia si
 * vino con él: lo guardado puede estar con o sin "+57". null si no
 * alcanza para ser un teléfono.
 */
export function digitosTelefono(texto: string): string | null {
  let d = soloDigitos(texto);
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return d.length >= MIN_DIGITOS_TELEFONO ? d : null;
}

/**
 * Patrón ilike que deja pasar cualquier separador entre caracteres
 * ("3%0%0%1…"): un primer filtro en la base que luego se confirma con
 * coincideTelefono / coincideDocumento. Solo recibe letras y dígitos,
 * así que no hay comodines que escapar.
 */
export function patronFlexible(caracteres: string): string {
  return `%${caracteres.split("").join("%")}%`;
}

/** El teléfono guardado es el buscado, con o sin indicativo delante. */
export function coincideTelefono(guardado: string | null | undefined, buscado: string): boolean {
  const g = soloDigitos(guardado);
  if (g.length < MIN_DIGITOS_TELEFONO) return false;
  return g === buscado || g.endsWith(buscado) || buscado.endsWith(g);
}

export function coincideDocumento(guardado: string | null | undefined, buscado: string): boolean {
  const g = normalizarDocumento(guardado);
  return g.length > 0 && g === buscado;
}

/** Número de orden escrito tal cual ("14"); el código de entrada va aparte. */
export function numeroOrdenEscrito(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,9}$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

export interface OrdenEncontrada {
  id: string;
  numero: number;
  abierta: boolean;
  abiertaEn: string;
  coincide: Coincidencia[];
}

/** El orden en que se muestran: primero las abiertas, luego la más reciente. */
export function ordenarResultados<T extends OrdenEncontrada>(ordenes: T[]): T[] {
  return [...ordenes].sort((a, b) => {
    if (a.abierta !== b.abierta) return a.abierta ? -1 : 1;
    return b.abiertaEn.localeCompare(a.abiertaEn);
  });
}
