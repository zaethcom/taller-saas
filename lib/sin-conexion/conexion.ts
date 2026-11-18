/**
 * ¿Hay internet? (plan sin internet, fase 0).
 *
 * `navigator.onLine` solo dice si el equipo tiene una red, no si esa
 * red llega a internet: un Wi-Fi del local sin salida sigue diciendo
 * «en línea». Por eso, además de los eventos online/offline, se
 * confirma con una petición corta al propio servidor
 * (/api/app/conexion). Un fallo de esa petición, o tardar más de
 * TIEMPO_MAXIMO_MS, cuenta como sin conexión.
 */

export const RUTA_PRUEBA = "/api/app/conexion";
export const TIEMPO_MAXIMO_MS = 5000;
/** Cada cuánto se vuelve a probar mientras no hay conexión. */
export const REINTENTO_SIN_CONEXION_MS = 15000;
/** Cada cuánto se confirma con conexión (barato: una respuesta vacía). */
export const REINTENTO_CON_CONEXION_MS = 60000;

export type EstadoConexion = "en_linea" | "sin_conexion";

/**
 * Combina lo que dice el navegador con la última prueba al servidor.
 * Si el navegador dice que no hay red, no hace falta probar nada.
 */
export function estadoConexion(navegadorEnLinea: boolean, ultimaPruebaOk: boolean | null): EstadoConexion {
  if (!navegadorEnLinea) return "sin_conexion";
  if (ultimaPruebaOk === false) return "sin_conexion";
  return "en_linea";
}

export function intervaloPrueba(estado: EstadoConexion): number {
  return estado === "sin_conexion" ? REINTENTO_SIN_CONEXION_MS : REINTENTO_CON_CONEXION_MS;
}

/** Prueba real contra el servidor, con tiempo máximo. */
export async function probarServidor(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  try {
    const r = await fetchImpl(RUTA_PRUEBA, { method: "GET", cache: "no-store", signal: control.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(reloj);
  }
}
