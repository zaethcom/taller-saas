/**
 * Reglas para lo que llega de una venta hecha sin internet (plan sin
 * internet, fase 3; migración 0070): la clave que evita duplicados y la
 * hora real en que se hizo.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Máximo tiempo sin conexión aceptado (decisión D3 del plan: 72 h). */
export const MAXIMO_SIN_CONEXION_MS = 72 * 60 * 60 * 1000;
/** Tolerancia por relojes de equipo un poco adelantados. */
const TOLERANCIA_FUTURO_MS = 10 * 60 * 1000;

export function claveLocalValida(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

/**
 * La hora en que se hizo la venta sin conexión, si es creíble: no en el
 * futuro (más allá de unos minutos) ni más vieja que el máximo sin
 * conexión. Si no es creíble se descarta (null) y la venta queda con la
 * hora en que llegó, que es lo que pasaba siempre.
 */
export function horaSinConexion(valor: unknown, ahora = Date.now()): string | null {
  if (typeof valor !== "string") return null;
  const t = Date.parse(valor);
  if (Number.isNaN(t)) return null;
  if (t > ahora + TOLERANCIA_FUTURO_MS) return null;
  if (t < ahora - MAXIMO_SIN_CONEXION_MS) return null;
  return new Date(t).toISOString();
}

/** El error de Postgres/PostgREST de una columna que aún no existe (migración sin correr). */
export function esColumnaFaltante(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}
