/**
 * POST /api/ordenes/<id>/repuestos
 * Body: { accion: "consumir", repuestoId, cantidad }
 *     | { accion: "faltante", descripcion, cantidad, prioridad }
 *
 * Consumir descuenta el inventario de la sede de la orden (vía
 * consumir_repuesto, la misma función que usa /api/ventas) y deja el
 * registro en orden_repuesto. Faltante crea la solicitud que aparece
 * en /compras -- la lista central de la sección 4 del documento
 * original: qué hace falta, para qué orden, con qué prioridad.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

type Cuerpo =
  | { accion: "consumir"; repuestoId: string; cantidad: number }
  // repuestoId es opcional en un faltante: puede ser algo que todavía no
  // está en el catálogo, y entonces solo hay descripción. Cuando sí está,
  // guardarlo permite después pedírselo a la otra sede.
  | {
      accion: "faltante";
      descripcion: string;
      cantidad: number;
      prioridad?: string;
      repuestoId?: string;
    };

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

    const { error: errConsumo } = await supabase.rpc("consumir_repuesto", {
      p_repuesto_id: body.repuestoId,
      p_sede_id: orden.sede_id,
      p_cantidad: body.cantidad,
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

    // sede_solicitante_id: sin esto, /compras no puede decir para qué sede
    // es el faltante -- y con dos sedes eso deja de ser un detalle.
    const { error } = await supabase.from("repuesto_solicitud").insert({
      empresa_id: orden.empresa_id,
      orden_id: id,
      repuesto_id: body.repuestoId ?? null,
      descripcion: body.descripcion.trim(),
      cantidad: body.cantidad,
      prioridad: body.prioridad ?? "normal",
      estado: "faltante",
      sede_solicitante_id: orden.sede_id,
      solicitado_por: user.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "acción no reconocida" }, { status: 400 });
}
