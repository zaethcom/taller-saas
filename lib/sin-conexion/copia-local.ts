/**
 * Dónde vive la copia de datos en el equipo (plan sin internet, fase 2):
 * IndexedDB (base-local.ts), almacén «copia», un solo registro «actual»
 * con la copia de la sede en la que se está trabajando. Una sola copia a
 * la vez: al cambiar de sede o de usuario la sincronización la
 * reemplaza, y al cerrar sesión se borra (borrar-copia.ts).
 */
import { ALMACEN_COPIA, operar } from "./base-local";
import type { CopiaLocal } from "./tipos";

const CLAVE = "actual";

/** Copia en memoria para no abrir IndexedDB en cada tecla del buscador. */
let enMemoria: CopiaLocal | null = null;

export async function leerCopia(): Promise<CopiaLocal | null> {
  if (enMemoria) return enMemoria;
  const copia = await operar<CopiaLocal | undefined>(ALMACEN_COPIA, "readonly", (a) => a.get(CLAVE));
  enMemoria = copia && copia.version === 1 ? copia : null;
  return enMemoria;
}

export async function guardarCopia(copia: CopiaLocal): Promise<void> {
  enMemoria = copia;
  await operar(ALMACEN_COPIA, "readwrite", (a) => a.put(copia, CLAVE));
}

export async function borrarCopiaDatos(): Promise<void> {
  enMemoria = null;
  await operar(ALMACEN_COPIA, "readwrite", (a) => a.delete(CLAVE));
}
