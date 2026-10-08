/**
 * POST /api/perfil/sede
 * Body: { sedeId }
 *
 * Elegir en qué sede se está trabajando en este dispositivo (ver
 * lib/sede-activa.ts). Solo acepta una de las sedes permitidas del
 * usuario -- lo que se guarda en la cookie es una elección validada,
 * y además se vuelve a validar en cada lectura.
 */
import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@/lib/perfil";
import { COOKIE_SEDE, OPCIONES_COOKIE_SEDE } from "@/lib/sede-activa";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sedeId?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const sede = perfil.sedesPermitidas.find((s) => s.id === body.sedeId);
  if (!sede) {
    return NextResponse.json({ error: "no tienes acceso a esa sede" }, { status: 403 });
  }

  const respuesta = NextResponse.json({ ok: true, sedeId: sede.id, sedeNombre: sede.nombre });
  respuesta.cookies.set(COOKIE_SEDE, sede.id, OPCIONES_COOKIE_SEDE);
  return respuesta;
}
