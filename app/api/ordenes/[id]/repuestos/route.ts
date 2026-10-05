/**
 * POST /api/ordenes/<id>/repuestos
 * Body: { accion: "consumir", repuestoId, cantidad }
 *     | { accion: "faltante", descripcion, cantidad, prioridad }
 *
 * Consumir descuenta el inventario de la sede de la orden (vía
 * mover_existencia, la misma función que usa /api/ventas), deja el
 * registro en orden_repuesto (histórico, sin cambios) y en orden_item
 * (lo que de verdad se cobra -- Fase 5 del Plan 1), recalculando
 * orden.total. Si existe una repuesto_solicitud de esta orden ya
 * "recibida" que describe el mismo repuesto, se cierra el ciclo
 * marcándola "consumida" (Fase 6) -- no hay FK entre las dos tablas
 * (una solicitud puede ser de algo que todavía no está en el
 * catálogo), así que el único vínculo posible es la descripción.
 *
 * Faltante crea la solicitud que aparece en /compras -- la lista
 * central de la sección 4 del documento original: qué hace falta,
 * para qué orden, con qué prioridad.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { recalcularTotalOrden } from "@/lib/orden-total";
import { requiereNuevaAprobacion } from "@/lib/orden-aprobacion";

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

    const { data: repuesto } = await supabase
      .from("repuesto")
      .select("descripcion, precio_venta")
      .eq("id", body.repuestoId)
      .single();
    if (!repuesto) {
      return NextResponse.json({ error: "repuesto no encontrado" }, { status: 404 });
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

    const precioUnit = Number(repuesto.precio_venta);
    await supabase.from("orden_item").insert({
      empresa_id: orden.empresa_id,
      orden_id: id,
      tipo: "repuesto",
      repuesto_id: body.repuestoId,
      descripcion: repuesto.descripcion,
      cantidad: body.cantidad,
      precio_unit: precioUnit,
      subtotal: precioUnit * body.cantidad,
      creado_por: user.id,
      requiere_aprobacion: await requiereNuevaAprobacion(supabase, id),
    });
    await recalcularTotalOrden(supabase, id);

    // Fase 6: cierra el ciclo faltante -> solicitado -> recibido ->
    // consumido si esta orden tenía una solicitud ya recibida para
    // (aparentemente) este mismo repuesto.
    await supabase
      .from("repuesto_solicitud")
      .update({ estado: "consumido" })
      .eq("orden_id", id)
      .eq("estado", "recibido")
      .ilike("descripcion", repuesto.descripcion);

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
