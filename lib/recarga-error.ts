/**
 * Qué hacer cuando la app revienta en el navegador ("Application error:
 * a client-side exception"). La causa más común en este sistema no es un
 * error del código sino una versión vieja abierta: el POS y la app del
 * técnico quedan abiertos todo el día, se publica un cambio, y la
 * siguiente navegación mezcla el JS viejo que ya está cargado con
 * pantallas de la versión nueva. Recargar la página lo arregla.
 *
 * Por eso la pantalla de error (app/error.tsx, app/global-error.tsx)
 * recarga sola una vez. Si el error vuelve a salir enseguida ya no es
 * la versión vieja: se queda en pantalla con el mensaje, para poder
 * decir qué falló, y un botón para intentar de nuevo.
 */

export const CLAVE_RECARGA = "taller360:recarga-por-error";

/** Si el último intento fue hace menos que esto, no se recarga otra vez. */
export const VENTANA_RECARGA_MS = 30_000;

export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

/**
 * ¿Toca recargar sola? Sí, salvo que ya se haya recargado por un error
 * hace poco -- así nunca queda en un ciclo de recargas. Anota el intento
 * cuando dice que sí. Sin almacenamiento (modo privado, bloqueado) no
 * recarga sola: sin la marca no hay cómo evitar el ciclo.
 */
export function debeRecargar(almacen: Almacen | null, ahora: number): boolean {
  if (!almacen) return false;
  try {
    const anterior = Number(almacen.getItem(CLAVE_RECARGA));
    if (Number.isFinite(anterior) && anterior > 0 && ahora - anterior < VENTANA_RECARGA_MS) return false;
    almacen.setItem(CLAVE_RECARGA, String(ahora));
    return true;
  } catch {
    return false;
  }
}

/** El texto del error para mostrar en pantalla, corto y sin pila. */
export function textoDelError(error: unknown): string {
  if (error instanceof Error) {
    const texto = `${error.name}: ${error.message}`.trim();
    return texto.length > 300 ? `${texto.slice(0, 300)}…` : texto;
  }
  return String(error);
}
