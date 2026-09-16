/**
 * POST /api/repuesto-solicitud/<id>/recibir
 * Body: { repuestoId, sedeId, cantidad }
 *
 * Compras marca que llegó el repuesto -- lo que cierra el ciclo de la
 * sección 4 del documento original. La solicitud original solo trae una
 * descripción libre (lo que el técnico escribió al marcar faltante), así
 * que quien recibe confirma contra qué repuesto real del catálogo
 * corresponde y en qué sede entró. Antes esto solo cambiaba el estado
 * sin tocar `existencia` -- ahora pasa por mover_existencia (tipo
 * 'compra_recibida', referencia_id: la orden que lo pidió) y solo si
 * eso funciona se marca recibido: si algo falla a mitad de camino, la
 * solicitud sigue viéndose como pendiente en vez de mentir.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

interface Cuerpo {
  repuestoId: string;
  sedeId: string;
  cantidad: number;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Cuerpo>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.repuestoId || !body.sedeId) {
    return NextResponse.json({ error: "falta indicar el repuesto y la sede" }, { status: 400 });
  }
  if (!body.cantidad || body.cantidad <= 0) {
    return NextResponse.json({ error: "la cantidad debe ser mayor a cero" }, { status: 400 });
  }

  const { data: solicitud, error: errSolicitud } = await supabase
    .from("repuesto_solicitud")
    .select("id, orden_id, estado")
    .eq("id", id)
    .maybeSingle();

  if (errSolicitud || !solicitud) {
    return NextResponse.json({ error: "el faltante no existe" }, { status: 404 });
  }
  if (solicitud.estado !== "faltante") {
    return NextResponse.json({ error: "este faltante ya fue procesado" }, { status: 409 });
  }

  const { error: errMovimiento } = await supabase.rpc("mover_existencia", {
    p_repuesto_id: body.repuestoId,
    p_sede_id: body.sedeId,
    p_delta: body.cantidad,
    p_tipo: "compra_recibida",
    p_motivo: null,
    p_referencia_id: solicitud.orden_id,
  });
  if (errMovimiento) {
    return NextResponse.json({ error: errMovimiento.message }, { status: 500 });
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
