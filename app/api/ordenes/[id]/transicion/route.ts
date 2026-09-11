/**
 * POST /api/ordenes/<id>/transicion
 * Body: { aEstado: Estado }
 *
 * La única puerta para cambiar el estado de una orden desde la app del
 * técnico o el admin. Arma el conjunto de requisitos cumplidos
 * consultando la orden real, y llama a la misma transicionar() de
 * lib/estados.ts que usa /api/aprobacion -- ninguna pantalla decide
 * por su cuenta si un salto es válido.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  RequisitoFaltanteError,
  TransicionInvalidaError,
  transicionar,
  type Estado,
  type Requisito,
} from "@/lib/estados";
import { saldoEnCero } from "@/lib/caja";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { aEstado?: Estado };
  if (!body.aEstado) {
    return NextResponse.json({ error: "falta aEstado" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, tecnico_id")
    .eq("id", id)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const cumplidos = new Set<Requisito>();

  const [{ count: fotoEntrada }, { count: fotoSalida }, { count: firma }, { count: etiqueta }] =
    await Promise.all([
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "foto")
        .eq("fase", "entrada"),
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "foto")
        .eq("fase", "salida"),
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "firma"),
      supabase
        .from("trabajo_impresion")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "etiqueta_qr")
        .eq("estado", "impreso"),
    ]);

  if ((fotoEntrada ?? 0) > 0) cumplidos.add("tiene_foto_entrada");
  if ((fotoSalida ?? 0) > 0) cumplidos.add("tiene_foto_salida");
  if ((firma ?? 0) > 0) cumplidos.add("tiene_firma");
  if ((etiqueta ?? 0) > 0) cumplidos.add("tiene_etiqueta");

  // Nadie asignaba tecnico_id en ningún lugar del proyecto -- el
  // requisito tiene_tecnico de en_diagnostico no se podía cumplir nunca.
  // El punto natural para asignarlo es este: quien mueve la orden a
  // en_diagnostico se convierte en su técnico, autoasignado por hacer el
  // trabajo -- de ahí sale la productividad por técnico de la sección 5.
  const tecnicoId = orden.tecnico_id ?? (body.aEstado === "en_diagnostico" ? user.id : null);
  if (tecnicoId) cumplidos.add("tiene_tecnico");

  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("id, total, estado, decision")
    .eq("orden_id", id)
    .order("enviada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cotizacion) cumplidos.add("tiene_cotizacion");
  if (cotizacion?.decision === "aprobada") cumplidos.add("cotizacion_aprobada");

  if (cotizacion) {
    const { data: ventas } = await supabase
      .from("venta")
      .select("total")
      .eq("orden_id", id)
      .eq("anulada", false);
    const totalPagado = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
    if (saldoEnCero(Number(cotizacion.total), totalPagado)) cumplidos.add("saldo_en_cero");
  }

  try {
    transicionar(orden.estado as Estado, body.aEstado, cumplidos);
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const { error: errUpdate } = await supabase
    .from("orden")
    .update({
      estado: body.aEstado,
      tecnico_id: tecnicoId,
      cerrada_en: body.aEstado === "entregada" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: body.aEstado,
    autor_id: user.id,
  });

  return NextResponse.json({ ok: true, estado: body.aEstado });
}
