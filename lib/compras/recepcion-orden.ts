/**
 * Lo que Compras pide para una orden llega para esa orden: no entra al
 * inventario (decisión de Frank, 2026-10-22). Quien lo recibe anota el
 * producto que de verdad llegó y cuánto costó -- dato interno, para la
 * contabilidad de la orden -- y queda en el historial de la orden. El
 * técnico recibe el aviso y la orden sigue.
 *
 * Lo puro vive aquí para probarlo sin base; la ruta es
 * app/api/repuesto-solicitud/[id]/recibir/route.ts.
 */
import type { Estado } from "../estados";

/** Inicio de la nota del evento en orden_evento (sin cambio de estado). */
export const PREFIJO_REPUESTO_RECIBIDO = "Llegó el repuesto";

export interface RecepcionCompra {
  producto: string;
  cantidad: number;
  /** Lo que costó todo lo recibido (no por unidad). */
  costo: number;
}

/** Valida lo que llega del formulario de /compras. */
export function normalizarRecepcion(
  body: unknown,
): { ok: true; datos: RecepcionCompra } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const producto = typeof b.producto === "string" ? b.producto.replace(/\s+/g, " ").trim() : "";
  const cantidad = Math.floor(Number(b.cantidad));
  const costo = Number(b.costo);
  if (!producto) return { ok: false, error: "Escribe el nombre del producto que llegó" };
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a cero" };
  if (b.costo === "" || b.costo == null || !Number.isFinite(costo) || costo < 0) {
    return { ok: false, error: "Escribe cuánto costó la compra (0 si no costó nada)" };
  }
  return { ok: true, datos: { producto: producto.slice(0, 200), cantidad, costo: Math.round(costo * 100) / 100 } };
}

/** La nota del historial. Sin el costo: el historial lo ve el técnico. */
export function notaRepuestoRecibido(r: { producto: string; cantidad: number }): string {
  return `${PREFIJO_REPUESTO_RECIBIDO}: ${r.producto}${r.cantidad > 1 ? ` (x${r.cantidad})` : ""}`;
}

export function esEventoRepuestoRecibido(e: { de_estado: string | null; a_estado: string; nota?: string | null }): boolean {
  return e.de_estado === e.a_estado && (e.nota ?? "").startsWith(PREFIJO_REPUESTO_RECIBIDO);
}

/** Llegó lo último que le faltaba a una orden parada por repuesto: vuelve a en proceso. */
export function siguePorRepuesto(estado: Estado, pendientes: number): boolean {
  return estado === "falta_repuesto" && pendientes === 0;
}

export interface CompraOrden {
  producto: string;
  cantidad: number;
  /** null: se recibió antes de que se anotara el costo. */
  costo: number | null;
}

export interface RepuestoInventarioOrden {
  descripcion: string;
  cantidad: number;
  /** Costo unitario del catálogo; null si nunca se anotó. */
  costoUnit: number | null;
}

export interface ContabilidadOrden {
  /** Lo que vale la orden para el cliente (lib/cuenta-orden.ts). */
  cobrado: number;
  pagado: number;
  costoCompras: number;
  costoInventario: number;
  gastado: number;
  utilidad: number;
  /** Utilidad sobre lo cobrado, en %; null si no se ha cobrado nada. */
  margen: number | null;
  /** Repuestos sin costo anotado: la utilidad sale más alta de lo real. */
  sinCosto: number;
}

/** Cuánto se gastó, cuánto se cobró y cuánto quedó. Solo para el administrador. */
export function resumirContabilidad(a: {
  cobrado: number;
  pagado: number;
  compras: CompraOrden[];
  inventario: RepuestoInventarioOrden[];
}): ContabilidadOrden {
  const redondear = (n: number) => Math.round(n * 100) / 100;
  const costoCompras = redondear(a.compras.reduce((s, c) => s + (c.costo ?? 0), 0));
  const costoInventario = redondear(a.inventario.reduce((s, r) => s + (r.costoUnit ?? 0) * r.cantidad, 0));
  const gastado = redondear(costoCompras + costoInventario);
  const utilidad = redondear(a.cobrado - gastado);
  const sinCosto =
    a.compras.filter((c) => c.costo == null).length + a.inventario.filter((r) => r.costoUnit == null).length;
  return {
    cobrado: a.cobrado,
    pagado: a.pagado,
    costoCompras,
    costoInventario,
    gastado,
    utilidad,
    margen: a.cobrado > 0 ? Math.round((utilidad / a.cobrado) * 1000) / 10 : null,
    sinCosto,
  };
}
