/**
 * GET /api/clientes?documento=<doc>
 * Busca un cliente existente por documento, para no duplicar registros
 * cada vez que alguien vuelve al taller. RLS filtra por empresa sola.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const documento = req.nextUrl.searchParams.get("documento")?.trim();
  if (!documento) {
    return NextResponse.json({ error: "falta el documento" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data } = await supabase
    .from("cliente")
    .select("id, nombre, documento, telefono, correo")
    .eq("documento", documento)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
