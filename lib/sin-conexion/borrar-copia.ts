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

/**
 * Antes de cerrar sesión: si quedan ventas guardadas sin conexión, avisa
 * que no se pierden (quedan en el equipo y se suben cuando esa persona
 * vuelva a entrar) y deja cancelar. true = seguir con la salida.
 */
export async function confirmarSalida(): Promise<boolean> {
  const { listarCola } = await import("./cola");
  const pendientes = (await listarCola()).filter((e) => e.estado === "pendiente").length;
  if (pendientes === 0) return true;
  return window.confirm(
    `Hay ${pendientes} ${pendientes === 1 ? "venta guardada" : "ventas guardadas"} sin conexión que todavía no se ${
      pendientes === 1 ? "subió" : "subieron"
    }. Quedan en este equipo y se suben cuando vuelvas a entrar con internet. ¿Cerrar sesión de todas formas?`,
  );
}
