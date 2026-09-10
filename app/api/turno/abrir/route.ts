/**
 * POST /api/turno/abrir
 * Body: { baseInicial: number }
 * Abre el turno de caja de la sede del usuario. Falla si ya hay uno
 * abierto -- dos turnos abiertos a la vez es exactamente lo que hace
 * imposible cuadrar caja al final del día.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { baseInicial?: number };
  if (typeof body.baseInicial !== "number" || body.baseInicial < 0) {
    return NextResponse.json({ error: "falta la base inicial" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  const { data: yaAbierto } = await supabase
    .from("turno_caja")
    .select("id")
    .eq("sede_id", perfil.sede_id)
    .is("cerrado_en", null)
    .maybeSingle();

  if (yaAbierto) {
    return NextResponse.json({ error: "ya hay un turno abierto en esta sede" }, { status: 409 });
  }

  const { data: turno, error } = await supabase
    .from("turno_caja")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: perfil.sede_id,
      abierto_por: user.id,
      base_inicial: body.baseInicial,
    })
    .select("id")
    .single();

  if (error || !turno) {
    return NextResponse.json({ error: error?.message ?? "no se pudo abrir el turno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, turnoId: turno.id });
}
