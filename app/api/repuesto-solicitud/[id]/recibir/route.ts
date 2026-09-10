/**
 * POST /api/repuesto-solicitud/<id>/recibir
 * Compras marca que llegó el repuesto. Es lo que cierra el ciclo de
 * la sección 4 del documento original: "cuando llega el repuesto, se
 * registra su recepción y se vincula nuevamente con la orden que lo
 * necesitaba" -- la orden ya estaba vinculada desde que se creó la
 * solicitud (repuesto_solicitud.orden_id); aquí solo cambia el estado.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("repuesto_solicitud")
    .update({ estado: "recibido", recibido_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "faltante")
    .select("id, orden_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "el faltante no existe o ya fue procesado" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, ordenId: data.orden_id });
}
