/**
 * POST /api/traslados/<id>/recibir
 * Quien recibe en la sede destino confirma que llegó -- ahí, y solo ahí,
 * se suma la existencia (sumar_existencia, 0014_traslados.sql). Antes de
 * este POST el inventario ya salió del origen pero todavía no existe en
 * ningún lado: es mercancía en tránsito, no un número en dos sitios a
 * la vez.
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

  const { data: perfil } = await supabase.from("perfil").select("sede_id").eq("id", user.id).single();

  const { data: traslado, error: errTraslado } = await supabase
    .from("traslado")
    .select("id, sede_destino_id, estado, items:traslado_item ( repuesto_id, cantidad )")
    .eq("id", id)
    .single();

  if (errTraslado || !traslado) {
    return NextResponse.json({ error: "el traslado no existe" }, { status: 404 });
  }
  if (traslado.estado !== "enviado") {
    return NextResponse.json({ error: "este traslado ya fue procesado" }, { status: 409 });
  }
  if (traslado.sede_destino_id !== perfil?.sede_id) {
    return NextResponse.json({ error: "este traslado no es para tu sede" }, { status: 403 });
  }

  for (const item of traslado.items) {
    const { error: errSuma } = await supabase.rpc("sumar_existencia", {
      p_repuesto_id: item.repuesto_id,
      p_sede_id: traslado.sede_destino_id,
      p_cantidad: item.cantidad,
    });
    if (errSuma) {
      return NextResponse.json({ error: errSuma.message }, { status: 500 });
    }
  }

  const { error: errUpdate } = await supabase
    .from("traslado")
    .update({ estado: "recibido", recibido_por: user.id, recibido_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "enviado");

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
