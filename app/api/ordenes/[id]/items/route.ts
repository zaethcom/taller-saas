/**
 * POST /api/ordenes/<id>/items
 * Body: { tipo: "servicio" | "mano_obra", id: string, cantidad?: number }
 *
 * Registra un servicio realizado o mano de obra aplicada durante la
 * reparación -- a diferencia de /api/ordenes/[id]/repuestos (acción
 * "consumir"), esto no toca inventario: solo inserta orden_item y
 * recalcula orden.total. Fase 5 del Plan 1.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { recalcularTotalOrden } from "@/lib/orden-total";

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
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recalcularTotalOrden(supabase, id);

  return NextResponse.json({ ok: true });
}
