/**
 * GET /api/ordenes/<id>/eventos
 * Fase 8 del Plan 1: el historial de orden_evento para el hub del
 * técnico/admin -- equivalente interno de lo que ya hace
 * app/api/seguimiento/[token]/route.ts para el cliente, pero
 * autenticado en vez de por token público. Solo lee -- orden_evento ya
 * se escribe en cada transición (supabase/migrations/0001_base.sql),
 * nunca se escribe desde acá.
 */
import { NextRequest, NextResponse } from "next/server";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
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

  const { data: eventos, error } = await supabase
    .from("orden_evento")
    .select("a_estado, nota, autor_id, ocurrio_en")
    .eq("orden_id", id)
    .order("ocurrio_en", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (eventos ?? []).map((e) => ({
      estado: e.a_estado,
      etiqueta: ETIQUETA_ESTADO[e.a_estado as Estado],
      nota: e.nota,
      fecha: e.ocurrio_en,
    })),
  );
}
