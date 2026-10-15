/**
 * El QR de la etiqueta trae la URL completa de seguimiento (ver
 * app/api/ordenes/route.ts) -- se extrae el token, no el número de
 * orden en sí. Lo usan /entregar y /abonos.
 */
export function extraerTokenDeSeguimiento(valor: string): string | null {
  try {
    const url = new URL(valor);
    const partes = url.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("seguimiento");
    return i >= 0 ? (partes[i + 1] ?? null) : null;
  } catch {
    return null;
  }
}
