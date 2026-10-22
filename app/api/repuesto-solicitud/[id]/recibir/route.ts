/**
 * POST /api/repuesto-solicitud/<id>/recibir
 * Body: { producto, cantidad, costo }
 *
 * Compras marca que llegó lo que se pidió para una orden. No entra al
 * inventario (decisión de Frank, 2026-10-22): queda asignado a esa
 * orden. Se anota el producto que de verdad llegó y cuánto costó --
 * interno, para la contabilidad de la orden, el técnico no lo ve -- y
 * el historial de la orden dice que llegó.
 *
 * Si era lo último que la orden esperaba y estaba en "Esperando
 * repuesto", pasa sola a reparación. En cualquier caso el técnico de la
 * orden recibe el aviso (globo y push): "llegó el repuesto, la orden
 * está lista para seguir".
 *
 * Un encargo de mostrador (sin orden, desde Vender) solo se marca
 * recibido: /compras ofrece avisarle al cliente por WhatsApp.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import type { Estado } from "@/lib/estados";
import { buscarPrimeraFase } from "@/lib/fases";
import { crearAviso } from "@/lib/avisos-servidor";
import { normalizarRecepcion, notaRepuestoRecibido, siguePorRepuesto } from "@/lib/compras/recepcion-orden";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  // El rol compras tiene gestionar_compras pero no gestionar_inventario,
  // y es justamente quien recibe lo que pidió.
  if (!puede(perfil.rol, "gestionar_compras") && !puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const recepcion = normalizarRecepcion(await req.json().catch(() => null));
  if (!recepcion.ok) {
    return NextResponse.json({ error: recepcion.error }, { status: 400 });
  }
  const { producto, cantidad, costo } = recepcion.datos;

  const { data, error } = await supabase
    .from("repuesto_solicitud")
    .update({
      estado: "recibido",
      recibido_en: new Date().toISOString(),
      recibido_por: perfil.id,
      producto,
      cantidad,
      costo_compra: costo,
    })
    .eq("id", id)
    .eq("estado", "faltante")
    .select("id, orden_id, empresa_id, cliente_nombre, cliente_telefono")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "el faltante no existe o ya fue procesado" }, { status: 409 });
  }

  const { data: orden } = data.orden_id
    ? await supabase
        .from("orden")
        .select("id, empresa_id, estado, fase:fase_id ( nombre )")
        .eq("id", data.orden_id)
        .maybeSingle()
    : { data: null };

  let estado: Estado | null = (orden?.estado as Estado | undefined) ?? null;
  if (orden) {
    const faseActual = (orden.fase as unknown as { nombre: string } | null)?.nombre ?? null;
    // Sin cambio de estado: es un paso del historial, como una corrección de datos.
    await supabase.from("orden_evento").insert({
      empresa_id: orden.empresa_id,
      orden_id: orden.id,
      de_estado: orden.estado,
      a_estado: orden.estado,
      de_fase: faseActual,
      a_fase: faseActual,
      nota: notaRepuestoRecibido({ producto, cantidad }),
      autor_id: perfil.id,
    });

    const { count: pendientes } = await supabase
      .from("repuesto_solicitud")
      .select("id", { count: "exact", head: true })
      .eq("orden_id", orden.id)
      .in("estado", ["faltante", "solicitado"]);

    if (siguePorRepuesto(orden.estado as Estado, pendientes ?? 0)) {
      const faseNueva = await buscarPrimeraFase(supabase, orden.empresa_id, "en_reparacion");
      const { error: errEstado } = await supabase
        .from("orden")
        .update({ estado: "en_reparacion", fase_id: faseNueva?.id ?? null })
        .eq("id", orden.id)
        .eq("estado", "esperando_repuesto");
      if (!errEstado) {
        estado = "en_reparacion";
        await supabase.from("orden_evento").insert({
          empresa_id: orden.empresa_id,
          orden_id: orden.id,
          de_estado: "esperando_repuesto",
          a_estado: "en_reparacion",
          de_fase: faseActual,
          a_fase: faseNueva?.nombre ?? null,
          nota: "Llegaron los repuestos pedidos: sigue la reparación",
          autor_id: perfil.id,
        });
      }
    }

    await crearAviso(clienteAdmin(), {
      empresaId: orden.empresa_id,
      ordenId: orden.id,
      tipo: "repuesto_recibido",
      detalle: producto,
    });
  }

  return NextResponse.json({
    ok: true,
    ordenId: data.orden_id,
    estado,
    cliente: data.orden_id ? null : { nombre: data.cliente_nombre, telefono: data.cliente_telefono },
  });
}
