/**
 * GET /api/app/impresion-local
 *
 * Lo que necesita el equipo para imprimir recibos sin internet (plan sin
 * internet, fase 5): el encabezado y pie de los recibos de la sede activa
 * con el logo ya convertido a puntos (lib/impresion.ts:marcaDeRecibo) y
 * el prefijo del código de entrada. La app lo guarda en la copia local
 * (componentes/sin-conexion/sincronizar-copia.tsx) y, sin conexión, arma
 * el recibo en el navegador con el mismo código de la estación
 * (estacion/resolver.ts) y lo manda a la impresora USB del equipo.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { anchoPapelSede, marcaDeRecibo } from "@/lib/impresion";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!perfil.sedeId) return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });

  const ancho = await anchoPapelSede(supabase, perfil.sedeId);
  const marca = await marcaDeRecibo(supabase, perfil.empresaId, perfil.sedeId, ancho);
  return NextResponse.json({ marca, cajero: perfil.nombre ?? null }, { headers: { "Cache-Control": "no-store" } });
}
