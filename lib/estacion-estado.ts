/**
 * Lógica pura sobre el estado de una estación de impresión, sin nada de
 * servidor: la usa la pantalla de /sedes en el navegador.
 */
/** Qué decir del latido de una estación en la pantalla de sedes. */
export type EstadoConexion = "en_linea" | "sin_conexion" | "nunca";

/**
 * "En línea" si habló hace menos de dos minutos: el latido se anota cada
 * 30 s, así que dos minutos deja margen para un par de consultas perdidas
 * por la red del local sin alarmar a nadie.
 */
export function estadoConexion(ultimoContacto: string | null | undefined, ahora = new Date()): EstadoConexion {
  if (!ultimoContacto) return "nunca";
  const hace = ahora.getTime() - new Date(ultimoContacto).getTime();
  return hace < 2 * 60_000 ? "en_linea" : "sin_conexion";
}

/**
 * El config.json que la estación necesita para arrancar, con la clave
 * recién generada. Las impresoras no van aquí: la estación las pide a la
 * web al arrancar (GET /api/estacion/impresoras), así que se editan desde
 * /sedes y no en el aparato.
 */
export function configEstacion(datos: { sedeId: string; apiBase: string; clave: string }) {
  return {
    sedeId: datos.sedeId,
    apiBase: datos.apiBase.replace(/\/+$/, ""),
    servicioClave: datos.clave,
    intervaloMs: 2000,
  };
}
