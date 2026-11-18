/**
 * Números de orden apartados por este equipo para recibir sin internet
 * (plan sin internet, fase 4; decisión D2; migración 0071).
 *
 * Con internet, el equipo pide a /api/app/bloque-numeros los números que
 * tiene libres (el servidor aparta un bloque nuevo cuando quedan pocos).
 * Sin internet, Recibir toma el menor número libre y la orden sube
 * después con ese mismo número.
 *
 * Vive en el almacén «copia» de IndexedDB con claves propias, que NO se
 * borran al cerrar sesión: el identificador del equipo y los números
 * apartados son del equipo, no de quien entró. Los números van con su
 * empresa: si entra otra empresa, no se usan.
 */
import { ALMACEN_COPIA, operar } from "./base-local";

const CLAVE_EQUIPO = "equipo";
const CLAVE_BLOQUE = "bloque";

export interface BloqueGuardado {
  empresaId: string;
  libres: number[];
  actualizadoEn: string;
}

function nuevoIdEquipo(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** El identificador de este equipo; se crea la primera vez. null sin IndexedDB. */
export async function idEquipo(): Promise<string | null> {
  const actual = await operar<string | undefined>(ALMACEN_COPIA, "readonly", (a) => a.get(CLAVE_EQUIPO));
  if (typeof actual === "string" && actual.length >= 8) return actual;
  const nuevo = nuevoIdEquipo();
  const ok = await operar(ALMACEN_COPIA, "readwrite", (a) => a.put(nuevo, CLAVE_EQUIPO));
  return ok === null ? null : nuevo;
}

export async function leerBloque(empresaId: string): Promise<BloqueGuardado | null> {
  const b = await operar<BloqueGuardado | undefined>(ALMACEN_COPIA, "readonly", (a) => a.get(CLAVE_BLOQUE));
  return b && b.empresaId === empresaId && Array.isArray(b.libres) ? b : null;
}

async function guardarBloque(b: BloqueGuardado): Promise<void> {
  await operar(ALMACEN_COPIA, "readwrite", (a) => a.put(b, CLAVE_BLOQUE));
}

/**
 * Los libres según el servidor, menos los que este equipo ya usó en
 * recepciones que todavía están en la cola (el servidor aún no las ve).
 */
export function libresSinUsados(libresServidor: number[], usadosEnCola: number[]): number[] {
  const usados = new Set(usadosEnCola);
  return [...new Set(libresServidor)].filter((n) => Number.isInteger(n) && n > 0 && !usados.has(n)).sort((a, b) => a - b);
}

/** Guarda lo que respondió el servidor, descontando lo usado que falta subir. */
export async function actualizarBloque(empresaId: string, libresServidor: number[], usadosEnCola: number[]): Promise<void> {
  await guardarBloque({
    empresaId,
    libres: libresSinUsados(libresServidor, usadosEnCola),
    actualizadoEn: new Date().toISOString(),
  });
}

/** Toma el menor número libre para una recepción sin conexión. null si no queda ninguno. */
export async function tomarNumero(empresaId: string): Promise<number | null> {
  const b = await leerBloque(empresaId);
  if (!b || b.libres.length === 0) return null;
  const [numero, ...resto] = b.libres;
  await guardarBloque({ ...b, libres: resto });
  return numero ?? null;
}

/** Devuelve un número que se tomó y al final no se usó (no se pudo guardar la recepción). */
export async function devolverNumero(empresaId: string, numero: number): Promise<void> {
  const b = await leerBloque(empresaId);
  if (!b) return;
  await guardarBloque({ ...b, libres: libresSinUsados([...b.libres, numero], []) });
}
