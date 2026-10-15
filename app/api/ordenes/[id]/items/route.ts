/**
 * POST /api/ordenes/<id>/items
 * Body: { tipo: "servicio" | "mano_obra", id: string, cantidad?: number }
 *
 * Registra un servicio realizado o mano de obra aplicada durante la
 * reparación -- a diferencia de /api/ordenes/[id]/repuestos (acción
 * "consumir"), esto no toca inventario: solo inserta orden_item y
 * recalcula orden.total. Fase 5 del Plan 1.
 *
 * DELETE /api/ordenes/<id>/items?item=<orden_item.id>
 *
 * Quita algo que se agregó a la orden por error, solo mientras no se
 * ha enviado la cotización (itemsSeQuitan en lib/estados.ts). Si era un
 * repuesto consumido, vuelve al inventario de la sede con su
 * movimiento de auditoría.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { recalcularTotalOrden } from "@/lib/orden-total";
import { requiereNuevaAprobacion } from "@/lib/orden-aprobacion";
import { itemsSeQuitan, type Estado } from "@/lib/estados";

interface Cuerpo {
  tipo: "servicio" | "mano_obra";
  id: string;
  cantidad?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Cuerpo;

  if (!body.id || (body.tipo !== "servicio" && body.tipo !== "mano_obra")) {
    return NextResponse.json({ error: "faltan datos del ítem" }, { status: 400 });
  }
  const cantidad = body.cantidad && body.cantidad > 0 ? body.cantidad : 1;

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

  const tabla = body.tipo === "servicio" ? "servicio" : "mano_obra";
  const { data: catalogo } = await supabase.from(tabla).select("nombre, precio").eq("id", body.id).single();
  if (!catalogo) {
    return NextResponse.json({ error: "no encontrado en el catálogo" }, { status: 404 });
  }

  const precioUnit = Number(catalogo.precio);
  const { error } = await supabase.from("orden_item").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    tipo: body.tipo,
    servicio_id: body.tipo === "servicio" ? body.id : null,
    mano_obra_id: body.tipo === "mano_obra" ? body.id : null,
    descripcion: catalogo.nombre,
    cantidad,
    precio_unit: precioUnit,
    subtotal: precioUnit * cantidad,
    creado_por: user.id,
    requiere_aprobacion: await requiereNuevaAprobacion(supabase, id),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recalcularTotalOrden(supabase, id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = req.nextUrl.searchParams.get("item");
  if (!itemId) {
    return NextResponse.json({ error: "falta el ítem" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden } = await supabase.from("orden").select("numero, sede_id, estado").eq("id", id).maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }
  if (!itemsSeQuitan(orden.estado as Estado)) {
    return NextResponse.json(
      { error: "La cotización ya se envió: lo que está en la orden ya no se puede quitar." },
      { status: 409 },
    );
  }

  const { data: item } = await supabase
    .from("orden_item")
    .select("id, tipo, repuesto_id, cantidad")
    .eq("id", itemId)
    .eq("orden_id", id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: "ítem no encontrado" }, { status: 404 });
  }

  // El repuesto que se descontó al consumirlo vuelve a la sede.
  if (item.tipo === "repuesto" && item.repuesto_id) {
    const { error: errDevolver } = await supabase.rpc("mover_existencia", {
      p_repuesto_id: item.repuesto_id,
      p_sede_id: orden.sede_id,
      p_delta: item.cantidad,
      p_tipo: "consumo_orden",
      p_motivo: `Se quitó de la orden #${orden.numero} antes de cotizar`,
      p_referencia_id: id,
    });
    if (errDevolver) {
      return NextResponse.json({ error: errDevolver.message }, { status: 500 });
    }
  }

  const { error } = await supabase.from("orden_item").delete().eq("id", item.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recalcularTotalOrden(supabase, id);

  return NextResponse.json({ ok: true });
}
