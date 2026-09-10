/**
 * POST /api/evidencia
 * Body: { ordenId, ruta, tipo: "foto"|"video"|"firma", fase?: "entrada"|"salida", visibleCliente? }
 *
 * El archivo ya está en Storage cuando se llama esto -- el cliente lo
 * sube directo con clienteNavegador().storage, protegido por las
 * políticas de 0007_storage.sql (la ruta debe empezar con el
 * empresa_id del usuario, o Storage la rechaza antes de llegar aquí).
 * Esta ruta solo registra el hecho en la tabla `evidencia`, que es lo
 * que /api/ordenes/[id]/transicion consulta para verificar
 * tiene_foto_entrada, tiene_foto_salida y tiene_firma.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    ordenId?: string;
    ruta?: string;
    tipo?: "foto" | "video" | "firma";
    fase?: "entrada" | "salida";
    visibleCliente?: boolean;
  };

  if (!body.ordenId || !body.ruta || !body.tipo) {
    return NextResponse.json({ error: "faltan campos" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden } = await supabase
    .from("orden")
    .select("empresa_id")
    .eq("id", body.ordenId)
    .maybeSingle();

  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("evidencia")
    .insert({
      empresa_id: orden.empresa_id,
      orden_id: body.ordenId,
      ruta: body.ruta,
      tipo: body.tipo,
      fase: body.fase ?? null,
      autor_id: user.id,
      visible_cliente: body.visibleCliente ?? false,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
