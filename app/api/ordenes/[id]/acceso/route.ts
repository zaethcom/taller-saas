/**
 * GET /api/ordenes/<id>/acceso
 *
 * La ÚNICA forma válida de leer el PIN/patrón de un equipo
 * (orden_acceso.valor) -- ver el comentario de
 * supabase/migrations/0036_orden_acceso.sql. La RLS de esa tabla aísla
 * por empresa, no decide quién adentro de la empresa puede verlo; eso
 * lo decide esta ruta con puede(rol, "ver_acceso_dispositivo").
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "ver_acceso_dispositivo")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data } = await supabase
    .from("orden_acceso")
    .select("tipo, valor, nota")
    .eq("orden_id", id)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
