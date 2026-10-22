/**
 * El cliente tal como sale en el recibo de una venta: nombre, y debajo
 * documento y teléfono si los tiene. null cuando la venta es a
 * consumidor final -- el recibo no imprime nada en ese caso.
 */
export interface ClienteRecibo {
  nombre: string;
  documento: string | null;
  telefono: string | null;
}

export function clienteImpreso(
  c: { nombre: string; documento: string | null; telefono: string | null } | null | undefined,
): ClienteRecibo | null {
  if (!c?.nombre?.trim()) return null;
  return { nombre: c.nombre.trim(), documento: c.documento?.trim() || null, telefono: c.telefono?.trim() || null };
}
