/**
 * Dirección principal del sistema. Las páginas abiertas por la dirección
 * vieja de Vercel (o por el dominio sin www) se mandan a esta, para que
 * todos los equipos, la app instalada y los enlaces de seguimiento usen
 * la misma.
 *
 * No se redirige lo que usan las estaciones de impresión: /api (el puente
 * Android y la estación de PC hacen POST con apiBase = dirección vieja, y
 * un redirect de un POST no siempre se repite) ni /estacion (la
 * vinculación y el permiso USB quedan guardados por dirección; mudarla
 * obligaría a vincular otra vez). Tampoco archivos sueltos como sw.js.
 */
export const DOMINIO_PRINCIPAL = "www.taller360.app";

const DOMINIOS_A_MUDAR = new Set(["taller-saas-mvp.vercel.app", "taller360.app"]);

export function urlDominioPrincipal(
  host: string | null,
  metodo: string,
  ruta: string,
  busqueda: string,
): string | null {
  if (!host) return null;
  if (!DOMINIOS_A_MUDAR.has(host.toLowerCase().replace(/:\d+$/, ""))) return null;
  if (metodo !== "GET" && metodo !== "HEAD") return null;
  if (ruta === "/api" || ruta.startsWith("/api/")) return null;
  if (ruta === "/estacion" || ruta.startsWith("/estacion/")) return null;
  if (ruta.startsWith("/_next/")) return null;
  if (/\.[a-z0-9]+$/i.test(ruta)) return null;
  return `https://${DOMINIO_PRINCIPAL}${ruta}${busqueda}`;
}
