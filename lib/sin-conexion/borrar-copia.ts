/**
 * Borra las pantallas guardadas para abrir sin internet (public/sw.js,
 * CACHE_PAGINAS). Se llama al cerrar sesión y al entrar con otro
 * usuario: esas copias traen nombres y teléfonos de clientes y no deben
 * quedar en el equipo para el siguiente que lo use.
 *
 * Nunca falla: si el navegador no tiene Cache Storage no hay nada que
 * borrar.
 */
export const CACHE_PAGINAS = "taller-paginas-v1";

export async function borrarCopiaLocal(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE_PAGINAS);
  } catch {
    // sin Cache Storage (o bloqueado): no hay copia que borrar
  }
}
