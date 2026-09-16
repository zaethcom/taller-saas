/**
 * POST /api/ordenes/<id>/repuestos
 * Body: { accion: "consumir", repuestoId, cantidad }
 *     | { accion: "faltante", descripcion, cantidad, prioridad }
 *
 * Consumir descuenta el inventario de la sede de la orden (vía
 * mover_existencia, la misma función que usa /api/ventas) y deja el
 * registro en orden_repuesto. Faltante crea la solicitud que aparece
 * en /compras -- la lista central de la sección 4 del documento
 * original: qué hace falta, para qué orden, con qué prioridad.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

type Cuerpo =
  | { accion: "consumir"; repuestoId: string; cantidad: number }
  | { accion: "faltante"; descripcion: string; cantidad: number; prioridad?: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Cuerpo;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden } = await supabase
    .from("orden")
    .select("empresa_id, sede_id")
    .eq("id", id)
    .maybeSingle();

  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  if (body.accion === "consumir") {
    if (!body.repuestoId || !body.cantidad || body.cantidad <= 0) {
      return NextResponse.json({ error: "faltan datos del repuesto" }, { status: 400 });
    }

    const { error: errConsumo } = await supabase.rpc("mover_existencia", {
      p_repuesto_id: body.repuestoId,
      p_sede_id: orden.sede_id,
      p_delta: -body.cantidad,
      p_tipo: "consumo_orden",
      p_referencia_id: id,
    });
    if (errConsumo) {
      return NextResponse.json({ error: errConsumo.message }, { status: 409 });
    }

    const { error: errRegistro } = await supabase.from("orden_repuesto").insert({
      empresa_id: orden.empresa_id,
      orden_id: id,
      repuesto_id: body.repuestoId,
      cantidad: body.cantidad,
      consumido_por: user.id,
    });
    if (errRegistro) {
      return NextResponse.json({ error: errRegistro.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.accion === "faltante") {
    if (!body.descripcion?.trim() || !body.cantidad || body.cantidad <= 0) {
      return NextResponse.json({ error: "faltan datos del faltante" }, { status: 400 });
    }

    const { error } = await supabase.from("repuesto_solicitud").insert({
      empresa_id: orden.empresa_id,
      orden_id: id,
      descripcion: body.descripcion.trim(),
      cantidad: body.cantidad,
      prioridad: body.prioridad ?? "normal",
      solicitado_por: user.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "acción no reconocida" }, { status: 400 });
}
