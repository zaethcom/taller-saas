/**
 * GET /api/productos?serial=<serial>
 * Busca un equipo por serial. El serial es el identificador permanente
 * que el QR codifica -- si ya existe, es el mismo equipo volviendo,
 * no uno nuevo, aunque cambie el motivo de la visita.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get("serial")?.trim();
  if (!serial) {
    return NextResponse.json({ error: "falta el serial" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data } = await supabase
    .from("producto")
    .select("id, serial, tipo, marca, modelo, cliente:cliente_id ( id, nombre )")
    .eq("serial", serial)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
