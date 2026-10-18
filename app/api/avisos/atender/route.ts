/**
 * POST /api/avisos/atender
 * Body: { ids?: string[], ordenId?: string, todos?: boolean }
 *
 * Quita avisos del globo para todo el taller: los marcados, los de una
 * orden (al abrirla en /orden/[id]) o todos los de la sede activa.
 */
import { NextRequest, NextResponse } from "next/server";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; ordenId?: unknown; todos?: unknown };
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let consulta = supabase
    .from("aviso")
    .update({ atendido_en: new Date().toISOString(), atendido_por: perfil.id })
    .is("atendido_en", null);

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    consulta = consulta.in("id", body.ids.filter((x): x is string => typeof x === "string"));
  } else if (typeof body.ordenId === "string") {
    consulta = consulta.eq("orden_id", body.ordenId);
  } else if (body.todos === true) {
    if (perfil.sedeId) consulta = consulta.eq("sede_id", perfil.sedeId);
  } else {
    return NextResponse.json({ error: "falta qué avisos marcar" }, { status: 400 });
  }

  const { error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
