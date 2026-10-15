/**
 * Reserva de repuestos al aprobar la cotización (0056_repuesto_reserva.sql).
 *
 * Lo cotizado del catálogo se aparta de lo que hay en la sede; lo que no
 * alcanza se pide a Compras. Lo que ya está apartado para OTRAS órdenes
 * no cuenta como disponible: dos órdenes no pueden contar con la misma
 * pantalla.
 */

export interface LineaReserva {
  repuestoId: string;
  descripcion: string;
  cantidad: number;
}

export interface PlanReserva {
  reservar: LineaReserva[];
  /** Lo que no alcanza: va a Compras. */
  faltan: LineaReserva[];
}

/**
 * `existencias`: repuestoId → cantidad física en la sede.
 * `reservadoOtras`: repuestoId → lo apartado para otras órdenes.
 * `reservadoEsta`: repuestoId → lo que esta orden ya tenía apartado
 * (una cotización anterior aprobada): no se aparta dos veces.
 */
export function planearReserva(
  lineas: LineaReserva[],
  existencias: ReadonlyMap<string, number>,
  reservadoOtras: ReadonlyMap<string, number>,
  reservadoEsta: ReadonlyMap<string, number> = new Map(),
): PlanReserva {
  const pedido = new Map<string, LineaReserva>();
  for (const l of lineas) {
    if (!l.repuestoId || l.cantidad <= 0) continue;
    const previo = pedido.get(l.repuestoId);
    pedido.set(l.repuestoId, previo ? { ...previo, cantidad: previo.cantidad + l.cantidad } : { ...l });
  }

  const reservar: LineaReserva[] = [];
  const faltan: LineaReserva[] = [];
  for (const l of pedido.values()) {
    const yaTiene = reservadoEsta.get(l.repuestoId) ?? 0;
    const necesita = Math.max(0, l.cantidad - yaTiene);
    if (necesita === 0) continue;
    const libre = Math.max(
      0,
      (existencias.get(l.repuestoId) ?? 0) - (reservadoOtras.get(l.repuestoId) ?? 0) - yaTiene,
    );
    const aparta = Math.min(libre, necesita);
    if (aparta > 0) reservar.push({ ...l, cantidad: aparta });
    if (necesita > aparta) faltan.push({ ...l, cantidad: necesita - aparta });
  }
  return { reservar, faltan };
}

/** Lo que se puede vender o usar en otra orden: lo que hay menos lo apartado. */
export function disponible(existencia: number, reservado: number): number {
  return Math.max(0, existencia - reservado);
}
