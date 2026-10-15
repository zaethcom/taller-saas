/**
 * Códigos internos que el sistema arma solo, para que todo producto
 * tenga un código de barras escaneable aunque el proveedor no traiga
 * uno: los artículos ya lo tenían (ART-000123, sale de articulo.numero);
 * los repuestos nuevos sin código toman REP-000123, el siguiente libre
 * entre los que ya siguen ese mismo formato.
 */
const FORMATO_REPUESTO = /^REP-(\d{6})$/;

export function codigoArticulo(numero: number): string {
  return `ART-${String(numero).padStart(6, "0")}`;
}

/** El siguiente REP-000123 libre, ignorando los códigos con otro formato (REP-LLA-001, F-1023…). */
export function siguienteCodigoRepuesto(existentes: string[]): string {
  let mayor = 0;
  for (const codigo of existentes) {
    const m = FORMATO_REPUESTO.exec(codigo);
    if (m) mayor = Math.max(mayor, Number(m[1]));
  }
  return `REP-${String(mayor + 1).padStart(6, "0")}`;
}

/** Copias pedidas al reimprimir: entero entre 1 y 100, o null si no sirve. */
export function copiasValidas(valor: unknown): number | null {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 100) return null;
  return n;
}

/**
 * Lo que entrega un lector (cámara o USB) tal como llega: sin espacios
 * ni caracteres de control alrededor (algunos lectores agregan \r, \n,
 * \t o el separador GS1 \x1d) y en mayúsculas, que es como se guardan
 * los códigos.
 */
export function normalizarCodigoEscaneado(valor: string): string {
  return valor.replace(/[\x00-\x1f\x7f]/g, "").trim().toUpperCase();
}

/** El número de un ART-000123 (también ART123), o null si no es un código de artículo. */
export function numeroDeCodigoArticulo(codigo: string): number | null {
  const m = /^ART-?(\d+)$/i.exec(codigo.trim());
  return m ? Number(m[1]) : null;
}
