/**
 * Borra todo lo guardado en el equipo para trabajar sin internet: las
 * pantallas (public/sw.js, CACHE_PAGINAS) y la copia de datos
 * (copia-local.ts, IndexedDB). Se llama al cerrar sesión y al entrar con
 * otro usuario: esas copias traen nombres y teléfonos de clientes y no
 * deben quedar en el equipo para el siguiente que lo use.
 *
 * Nunca falla: si el navegador no tiene Cache Storage o IndexedDB no hay
 * nada que borrar.
 */
import { borrarCopiaDatos } from "./copia-local";

export const CACHE_PAGINAS = "taller-paginas-v1";

export async function borrarCopiaLocal(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE_PAGINAS);
  } catch {
    // sin Cache Storage (o bloqueado): no hay copia que borrar
  }
  await borrarCopiaDatos();
}
