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
  // La portada (las tres puertas) también: es donde abre la app instalada.
  return ruta === "/" || PAGINAS_SIN_CONEXION.some((p) => ruta === p || ruta.startsWith(p + "/"));
}

/**
 * Las pantallas que se bajan de antemano, con internet, para que abran
 * sin conexión aunque solo se haya llegado a ellas por el menú
 * (componentes/sin-conexion/precargar-pantallas.tsx). Solo las de las
 * puertas a las que entra el rol: a las otras nunca va a ir.
 * /orden/[id] no se puede bajar de antemano (una por orden).
 */
export function pantallasParaPrecargar(puertas: { pos: boolean; taller: boolean }): string[] {
  const lista = ["/"];
  if (puertas.pos) lista.push("/vender", "/recibir", "/entregar", "/abonos", "/turno", "/recibos", "/sincronizacion");
  if (puertas.taller) lista.push("/escanear");
  return lista;
}
