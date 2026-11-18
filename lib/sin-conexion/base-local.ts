/**
 * La base IndexedDB «taller360» del plan sin internet. Dos almacenes:
 * - «copia»: la copia de datos de la sede (copia-local.ts, fase 2).
 * - «cola»: lo hecho sin conexión que falta subir (cola.ts, fase 3).
 *
 * Nada aquí lanza errores hacia la pantalla: sin IndexedDB (modo
 * privado, navegador viejo) las operaciones devuelven null y la app se
 * porta como antes.
 */
const BASE = "taller360";
const VERSION = 2;
export const ALMACEN_COPIA = "copia";
export const ALMACEN_COLA = "cola";

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    try {
      if (typeof indexedDB === "undefined") return resolver(null);
      const pedido = indexedDB.open(BASE, VERSION);
      pedido.onupgradeneeded = () => {
        const base = pedido.result;
        if (!base.objectStoreNames.contains(ALMACEN_COPIA)) base.createObjectStore(ALMACEN_COPIA);
        if (!base.objectStoreNames.contains(ALMACEN_COLA)) base.createObjectStore(ALMACEN_COLA, { keyPath: "id" });
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

export async function operar<T>(
  almacen: string,
  modo: IDBTransactionMode,
  hacer: (a: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const base = await abrir();
  if (!base) return null;
  return new Promise((resolver) => {
    try {
      const tx = base.transaction(almacen, modo);
      const pedido = hacer(tx.objectStore(almacen));
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
