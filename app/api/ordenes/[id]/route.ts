/**
 * GET /api/ordenes/<id>
 * Los datos que la pantalla de la orden del técnico necesita, desde la
 * vista orden_para_tecnico -- sin teléfono, correo ni documento del
 * cliente (ver supabase/migrations/0003_vista_tecnico.sql). Más si el
 * cliente no aprobó la última cotización: la orden sigue "Esperando al
 * cliente" y la ficha ofrece recotizar o entregar sin reparar.
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

  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("decision")
    .eq("orden_id", id)
    .order("enviada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ...data, cotizacion_rechazada: cotizacion?.decision === "rechazada" });
}
