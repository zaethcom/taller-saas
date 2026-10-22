/**
 * El carrito de /vender guardado en el navegador, para que no se pierda
 * si el cajero sale a otra pantalla (a buscar algo, a recibir un equipo)
 * y vuelve. Se borra al cobrar o al vaciarlo.
 *
 * La clave lleva empresa, sede y usuario: en un mismo computador pueden
 * turnarse dos cajeros, o uno cambiar de sede, y ninguno debe heredar
 * el carrito del otro. Vive en localStorage, así que es por equipo: no
 * viaja a otro computador.
 */

export interface LineaRepuestoGuardada {
  kind: "repuesto";
  repuestoId: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

export interface LineaArticuloGuardada {
  kind: "articulo";
  articuloId: string;
  codigo: string;
  descripcion: string;
  precioUnit: number;
}

export type LineaGuardada = LineaRepuestoGuardada | LineaArticuloGuardada;

/** Lo mínimo de localStorage que se usa, para poder probarlo sin navegador. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export function claveCarrito(empresaId: string, sedeId: string | null, usuarioId: string): string {
  return `taller-saas:carrito:${empresaId}:${sedeId ?? "sin-sede"}:${usuarioId}`;
}

const esTexto = (v: unknown): v is string => typeof v === "string";
const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function lineaValida(v: unknown): LineaGuardada | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  if (!esTexto(l.descripcion) || !esNumero(l.precioUnit) || l.precioUnit < 0) return null;
  if (l.kind === "repuesto") {
    if (!esTexto(l.repuestoId) || !esNumero(l.cantidad) || l.cantidad < 1) return null;
    return {
      kind: "repuesto",
      repuestoId: l.repuestoId,
      descripcion: l.descripcion,
      cantidad: Math.floor(l.cantidad),
      precioUnit: l.precioUnit,
    };
  }
  if (l.kind === "articulo") {
    if (!esTexto(l.articuloId) || !esTexto(l.codigo)) return null;
    return { kind: "articulo", articuloId: l.articuloId, codigo: l.codigo, descripcion: l.descripcion, precioUnit: l.precioUnit };
  }
  return null;
}

/**
 * Lo que haya guardado bajo esa clave. Lo que no se entienda (una
 * versión vieja, algo editado a mano) se descarta línea por línea en
 * vez de romper la pantalla.
 */
export function leerCarrito(almacen: Almacen | null, clave: string): LineaGuardada[] {
  if (!almacen) return [];
  try {
    const crudo = almacen.getItem(clave);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos.map(lineaValida).filter((l): l is LineaGuardada => l !== null);
  } catch {
    return [];
  }
}

/** Guarda el carrito; uno vacío borra la clave en vez de dejar "[]". */
export function guardarCarrito(almacen: Almacen | null, clave: string, lineas: LineaGuardada[]): void {
  if (!almacen) return;
  try {
    if (lineas.length === 0) almacen.removeItem(clave);
    else almacen.setItem(clave, JSON.stringify(lineas));
  } catch {
    // Navegación privada o almacenamiento lleno: el carrito sigue
    // funcionando, solo que no sobrevive a salir de la pantalla.
  }
}

/** localStorage si existe y se deja usar; null en el servidor o si está bloqueado. */
export function almacenNavegador(): Almacen | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
