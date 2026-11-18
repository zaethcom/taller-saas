/**
 * Qué pantallas guarda el service worker para abrirlas sin internet
 * (plan sin internet, fase 1). public/sw.js no puede importar este
 * archivo (se sirve tal cual, sin compilar), así que repite la lista en
 * PAGINAS_SIN_CONEXION; pruebas/sin-conexion.test.ts revisa que las dos
 * listas sean iguales.
 *
 * Solo las pantallas de mostrador y taller: son las que el plan pide
 * sin internet. Configuración, reportes, superadmin, login y el
 * seguimiento público siempre van a la red.
 */
export const PAGINAS_SIN_CONEXION = [
  "/vender",
  "/recibir",
  "/entregar",
  "/abonos",
  "/turno",
  "/recibos",
  "/orden",
  "/escanear",
  "/sincronizacion",
] as const;

export function debeGuardarPagina(ruta: string): boolean {
  return PAGINAS_SIN_CONEXION.some((p) => ruta === p || ruta.startsWith(p + "/"));
}
