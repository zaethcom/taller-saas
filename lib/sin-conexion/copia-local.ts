/**
 * Dónde vive la copia de datos en el equipo (plan sin internet, fase 2):
 * IndexedDB, base «taller360», almacén «copia», un solo registro
 * «actual» con la copia de la sede en la que se está trabajando. Una
 * sola copia a la vez: al cambiar de sede o de usuario la sincronización
 * la reemplaza, y al cerrar sesión se borra (borrar-copia.ts).
 *
 * Nada aquí lanza errores hacia la pantalla: sin IndexedDB (modo
 * privado, navegador viejo) simplemente no hay copia, y la app se porta
 * como antes.
 */
import type { CopiaLocal } from "./tipos";

const BASE = "taller360";
const ALMACEN = "copia";
const CLAVE = "actual";

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    try {
      if (typeof indexedDB === "undefined") return resolver(null);
      const pedido = indexedDB.open(BASE, 1);
      pedido.onupgradeneeded = () => {
        if (!pedido.result.objectStoreNames.contains(ALMACEN)) pedido.result.createObjectStore(ALMACEN);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

async function operar<T>(modo: IDBTransactionMode, hacer: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const base = await abrir();
  if (!base) return null;
  return new Promise((resolver) => {
    try {
      const tx = base.transaction(ALMACEN, modo);
      const pedido = hacer(tx.objectStore(ALMACEN));
      tx.oncomplete = () => {
        base.close();
        resolver(pedido.result ?? null);
      };
      tx.onerror = tx.onabort = () => {
        base.close();
        resolver(null);
      };
    } catch {
      base.close();
      resolver(null);
    }
  });
}

/** Copia en memoria para no abrir IndexedDB en cada tecla del buscador. */
let enMemoria: CopiaLocal | null = null;

export async function leerCopia(): Promise<CopiaLocal | null> {
  if (enMemoria) return enMemoria;
  const copia = await operar<CopiaLocal | undefined>("readonly", (a) => a.get(CLAVE));
  enMemoria = copia && copia.version === 1 ? copia : null;
  return enMemoria;
}

export async function guardarCopia(copia: CopiaLocal): Promise<void> {
  enMemoria = copia;
  await operar("readwrite", (a) => a.put(copia, CLAVE));
}

export async function borrarCopiaDatos(): Promise<void> {
  enMemoria = null;
  await operar("readwrite", (a) => a.delete(CLAVE));
}
