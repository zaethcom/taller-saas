/**
 * GET /api/app/conexion
 * Respuesta vacía y sin caché para que la app confirme que llega al
 * servidor (lib/sin-conexion/conexion.ts). No toca la base ni pide
 * sesión: solo responde.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
