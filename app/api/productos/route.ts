/**
 * GET /api/productos?serial=<serial>
 * Busca un equipo por serial. El serial es el identificador permanente
 * que el QR codifica -- si ya existe, es el mismo equipo volviendo,
 * no uno nuevo, aunque cambie el motivo de la visita.
 *
 * GET /api/productos (sin serial)
 * Lista todos los equipos de clientes de la empresa, para /equipos.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get("serial")?.trim();

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  if (!serial) {
    const { data, error } = await supabase
      .from("producto")
      .select("id, serial, tipo, marca, modelo, cliente:cliente_id ( id, nombre )")
      .order("creado_en", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  const { data } = await supabase
    .from("producto")
    .select("id, serial, tipo, marca, modelo, cliente:cliente_id ( id, nombre )")
    .eq("serial", serial)
    .maybeSingle();

  return NextResponse.json(data ?? null);
}
