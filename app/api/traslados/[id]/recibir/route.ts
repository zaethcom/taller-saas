/**
 * POST /api/traslados/<id>/recibir
 * Quien recibe en la sede destino confirma que llegó -- ahí, y solo ahí,
 * se suma la existencia a granel (sumar_existencia, 0014_traslados.sql)
 * o se marca un artículo individualizado de vuelta en 'en_stock', ya en
 * la sede destino (0018_articulos_en_venta_y_traslado.sql). Antes de
 * este POST el inventario ya salió del origen pero todavía no existe en
 * ningún lado: es mercancía en tránsito, no un número en dos sitios a
 * la vez.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("sede_id").eq("id", user.id).single();

  const { data: traslado, error: errTraslado } = await supabase
    .from("traslado")
    .select("id, sede_destino_id, estado, items:traslado_item ( repuesto_id, articulo_id, cantidad )")
    .eq("id", id)
    .single();

  if (errTraslado || !traslado) {
    return NextResponse.json({ error: "el traslado no existe" }, { status: 404 });
  }
  if (traslado.estado !== "enviado") {
    return NextResponse.json({ error: "este traslado ya fue procesado" }, { status: 409 });
  }
  if (traslado.sede_destino_id !== perfil?.sede_id) {
    return NextResponse.json({ error: "este traslado no es para tu sede" }, { status: 403 });
  }

  for (const item of traslado.items) {
    if (item.repuesto_id) {
      const { error: errSuma } = await supabase.rpc("sumar_existencia", {
        p_repuesto_id: item.repuesto_id,
        p_sede_id: traslado.sede_destino_id,
        p_cantidad: item.cantidad,
      });
      if (errSuma) {
        return NextResponse.json({ error: errSuma.message }, { status: 500 });
      }
    } else if (item.articulo_id) {
      const { error: errArticulo } = await supabase
        .from("articulo")
        .update({ estado: "en_stock", sede_id: traslado.sede_destino_id })
        .eq("id", item.articulo_id)
        .eq("estado", "trasladado");
      if (errArticulo) {
        return NextResponse.json({ error: errArticulo.message }, { status: 500 });
      }
    }
  }

  const { error: errUpdate } = await supabase
    .from("traslado")
    .update({ estado: "recibido", recibido_por: user.id, recibido_en: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "enviado");

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  // Si este traslado venía de una solicitud del taller, ya llegó: se cierra
  // sola. Obligar a marcarla a mano dejaría la bandeja llena de cosas que
  // están en el estante desde hace días. El filtro por estado la deja
  // idempotente: recibir dos veces no revive nada.
  const { error: errSolicitudes } = await supabase
    .from("repuesto_solicitud")
    .update({ estado: "recibido", recibido_en: new Date().toISOString() })
    .eq("traslado_id", id)
    .eq("estado", "en_traslado");

  if (errSolicitudes) {
    // El traslado SÍ se recibió y la existencia ya subió. Que no se haya
    // podido cerrar la solicitud es un detalle de bandeja, no un motivo
    // para decirle a quien recibió que falló.
    console.error("[traslados] no se pudo cerrar la solicitud del traslado", id, errSolicitudes.message);
  }

  return NextResponse.json({ ok: true });
}
