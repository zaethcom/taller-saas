/**
 * Una venta hecha sin internet (plan sin internet, fase 3): cómo queda
 * la copia local después de venderla, para que el mostrador no ofrezca
 * otra vez lo que ya salió mientras sigue sin conexión.
 */
import type { CopiaLocal } from "./tipos";

export interface ItemVendido {
  repuestoId?: string;
  articuloId?: string;
  cantidad: number;
}

/** La copia con la existencia descontada y los artículos vendidos fuera. No cambia la original. */
export function aplicarVentaEnCopia(copia: CopiaLocal, items: ItemVendido[]): CopiaLocal {
  const porRepuesto = new Map<string, number>();
  const articulos = new Set<string>();
  for (const i of items) {
    if (i.repuestoId) porRepuesto.set(i.repuestoId, (porRepuesto.get(i.repuestoId) ?? 0) + i.cantidad);
    if (i.articuloId) articulos.add(i.articuloId);
  }
  return {
    ...copia,
    repuestos: copia.repuestos
      .map((r) => (porRepuesto.has(r.id) ? { ...r, existenciaAqui: Math.max(0, r.existenciaAqui - porRepuesto.get(r.id)!) } : r))
      .filter((r) => r.existenciaAqui > 0),
    articulos: copia.articulos.filter((a) => !articulos.has(a.id)),
  };
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function descripcionVenta(total: number, unidades: number): string {
  return `Venta · ${fmt(total)} · ${unidades} ${unidades === 1 ? "unidad" : "unidades"}`;
}

/**
 * El fallo de un fetch por red (sin internet, o la red del local sin
 * salida que no responde a tiempo), no una respuesta de error del
 * servidor. Si el envío alcanzó a llegar antes de cortarse, la clave
 * local (0070) evita que la venta quede doble al reenviarla.
 */
export function esFalloDeRed(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const nombre = (error as { name?: unknown } | null)?.name;
  return nombre === "AbortError" || nombre === "TimeoutError";
}

/** Cuánto esperar al servidor antes de guardar la venta sin conexión. */
export const ESPERA_VENTA_MS = 20000;
