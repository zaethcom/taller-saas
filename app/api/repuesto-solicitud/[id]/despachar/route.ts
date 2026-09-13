/**
 * POST /api/repuesto-solicitud/<id>/despachar
 *
 * El almacén sí tiene lo que le pidieron y lo manda. Crea el traslado
 * -- descontando su existencia y emitiendo el comprobante que viaja con
 * la mercancía, igual que un traslado armado a mano -- y deja la
 * solicitud enganchada a él para poder cerrarla cuando el destino
 * confirme la recepción.
 *
 * El paso deliberadamente NO es automático por existencia: el número
 * puede no coincidir con el estante, y despachar algo que no está
 * dejaría la solicitud esperando un traslado que nunca llega.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { crearTraslado } from "@/lib/traslados";
import { transicionarSolicitud, type EstadoSolicitud } from "@/lib/solicitudes";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id")
    .eq("id", user.id)
    .single();
  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  const { data: solicitud } = await supabase
    .from("repuesto_solicitud")
    .select("id, estado, cantidad, descripcion, repuesto_id, sede_solicitante_id, sede_proveedora_id")
    .eq("id", id)
    .maybeSingle();

  if (!solicitud) {
    return NextResponse.json({ error: "la solicitud no existe" }, { status: 404 });
  }
  if (solicitud.sede_proveedora_id !== perfil.sede_id) {
    return NextResponse.json({ error: "esta solicitud no es para tu sede" }, { status: 403 });
  }
  if (!solicitud.repuesto_id || !solicitud.sede_solicitante_id) {
    return NextResponse.json({ error: "la solicitud no tiene repuesto o sede que la pidió" }, { status: 409 });
  }

  try {
    transicionarSolicitud(solicitud.estado as EstadoSolicitud, "en_traslado");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }

  const traslado = await crearTraslado(supabase, {
    empresaId: perfil.empresa_id,
    sedeOrigenId: perfil.sede_id,
    sedeDestinoId: solicitud.sede_solicitante_id,
    items: [
      {
        repuestoId: solicitud.repuesto_id,
        descripcion: solicitud.descripcion,
        cantidad: solicitud.cantidad,
      },
    ],
    nota: `Despacho de solicitud`,
    enviadoPor: user.id,
  });

  if (!traslado.ok) {
    return NextResponse.json({ error: traslado.error }, { status: traslado.estado });
  }

  // El traslado ya descontó la existencia. Si esto fallara, quedaría
  // mercancía en tránsito sin solicitud que la reclame -- por eso el
  // filtro por estado: dos despachos simultáneos no pueden ganar los dos.
  const { data: actualizada } = await supabase
    .from("repuesto_solicitud")
    .update({
      estado: "en_traslado",
      traslado_id: traslado.id,
      despachado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("estado", "pedido_a_sede")
    .select("id")
    .maybeSingle();

  if (!actualizada) {
    return NextResponse.json(
      { error: `el traslado ${traslado.numero} se creó pero la solicitud ya había cambiado de estado` },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, traslado: { id: traslado.id, numero: traslado.numero } });
}
