/**
 * GET /api/ordenes/<id>
 * Los datos que la pantalla de la orden del técnico necesita, desde la
 * vista orden_para_tecnico -- sin teléfono, correo ni documento del
 * cliente (ver supabase/migrations/0003_vista_tecnico.sql).
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orden_para_tecnico")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}
