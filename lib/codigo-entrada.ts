/**
 * El "código de entrada" que va en la etiqueta QR de una orden: el
 * prefijo que la empresa configuró (ej. "PS") + el número de orden con
 * ceros. Nunca se guarda en `orden`: siempre se recalcula desde ahí, así
 * que la recepción y una reimpresión dan exactamente el mismo código.
 */
export function codigoEntrada(prefijo: string | null | undefined, numeroOrden: number): string {
  return `${prefijo ?? "OR"}${String(numeroOrden).padStart(6, "0")}`;
}

/**
 * Lo inverso: de lo que leyó el escáner ("PS000013", o "ps13" escrito a
 * mano) al número de orden, si empieza con el prefijo de la empresa y el
 * resto son dígitos. null si no tiene esa forma -- entonces es un serial.
 */
export function numeroDesdeCodigoEntrada(prefijo: string | null | undefined, leido: string): number | null {
  const p = (prefijo ?? "OR").toUpperCase();
  const texto = leido.trim().toUpperCase();
  if (!texto.startsWith(p)) return null;
  const resto = texto.slice(p.length);
  if (!/^\d{1,9}$/.test(resto)) return null;
  const numero = Number(resto);
  return numero > 0 ? numero : null;
}
