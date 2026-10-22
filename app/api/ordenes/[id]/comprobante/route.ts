/**
 * POST /api/ordenes/<id>/comprobante
 * Vuelve a imprimir el comprobante de recepción de una orden, con los
 * datos que tiene ahora (lib/comprobante-recepcion.ts), en la impresora
 * de tickets de la sede en la que está trabajando quien lo pide. Es lo
 * que se usa después de corregir un dato que salió mal en el papel.
 *
 * Solo encola: no toca la orden.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { reimprimirComprobanteRecepcion } from "@/lib/comprobante-recepcion";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("empresa_id, rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "reimprimir_comprobante_orden")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const trabajo = await reimprimirComprobanteRecepcion(supabase, {
    ordenId: id,
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    creadoPor: user.id,
  });
  if (!trabajo) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
