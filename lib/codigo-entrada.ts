/**
 * El "código de entrada" que va en la etiqueta QR de una orden: el
 * prefijo que la empresa configuró (ej. "PS") + el número de orden con
 * ceros. Nunca se guarda en `orden`: siempre se recalcula desde ahí, así
 * que la recepción y una reimpresión dan exactamente el mismo código.
 */
export function codigoEntrada(prefijo: string | null | undefined, numeroOrden: number): string {
  return `${prefijo ?? "OR"}${String(numeroOrden).padStart(6, "0")}`;
}
