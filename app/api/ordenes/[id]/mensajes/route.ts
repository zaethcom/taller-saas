/**
 * GET /api/ordenes/<id>/mensajes -- el hilo completo, para el hub del
 * técnico/admin (app/(taller)/orden/[id]/page.tsx).
 * POST /api/ordenes/<id>/mensajes
 * Body: { texto: string }
 * El lado staff del mismo hilo que ve el cliente en /seguimiento/[token]
 * -- Fase F3 del Plan 3.
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

  const { data: mensajes } = await supabase
    .from("orden_mensaje")
    .select("autor_tipo, texto, creado_en")
    .eq("orden_id", id)
    .order("creado_en", { ascending: true });

  return NextResponse.json(
    (mensajes ?? []).map((m) => ({ autorTipo: m.autor_tipo, texto: m.texto, creadoEn: m.creado_en })),
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { texto?: string };
  const texto = body.texto?.trim();
  if (!texto) {
    return NextResponse.json({ error: "falta el mensaje" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden } = await supabase.from("orden").select("empresa_id").eq("id", id).maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const { error } = await supabase.from("orden_mensaje").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    autor_tipo: "staff",
    autor_id: user.id,
    texto,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
