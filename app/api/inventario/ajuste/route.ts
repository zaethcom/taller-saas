/**
 * POST /api/inventario/ajuste
 * Body: { repuestoId, sedeId, cantidadNueva, motivo }
 *
 * Fija la cantidad de un repuesto en una sede a un valor exacto -- lo
 * que falta para corregir un conteo físico, revertir una recepción mal
 * cargada, o registrar una merma. El motivo es obligatorio (a diferencia
 * de la recepción, donde es opcional): un ajuste manual sin explicación
 * es justo el caso que el punto 2 del documento de requerimientos pide
 * poder auditar. El delta se calcula acá mismo contra la existencia
 * actual y se pasa a mover_existencia (tipo 'ajuste_manual'), que deja
 * el rastro completo en movimiento_inventario.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

interface Cuerpo {
  repuestoId: string;
  sedeId: string;
  cantidadNueva: number;
  motivo: string;
}

export async function POST(req: Request) {
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
    return NextResponse.json({ error: "faltan datos del repuesto o la sede" }, { status: 400 });
  }
  if (body.cantidadNueva == null || body.cantidadNueva < 0) {
    return NextResponse.json({ error: "la cantidad nueva no puede ser negativa" }, { status: 400 });
  }
  if (!body.motivo?.trim()) {
    return NextResponse.json({ error: "el motivo del ajuste es obligatorio" }, { status: 400 });
  }

  const { data: existencia } = await supabase
    .from("existencia")
    .select("cantidad")
    .eq("repuesto_id", body.repuestoId)
    .eq("sede_id", body.sedeId)
    .maybeSingle();

  const cantidadActual = existencia?.cantidad ?? 0;
  const delta = body.cantidadNueva - cantidadActual;

  if (delta === 0) {
    return NextResponse.json({ error: "la cantidad nueva es igual a la actual" }, { status: 400 });
  }

  const { data: nuevaCantidad, error } = await supabase.rpc("mover_existencia", {
    p_repuesto_id: body.repuestoId,
    p_sede_id: body.sedeId,
    p_delta: delta,
    p_tipo: "ajuste_manual",
    p_motivo: body.motivo.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cantidad: nuevaCantidad });
}
