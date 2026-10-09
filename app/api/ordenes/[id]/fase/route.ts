/**
 * PATCH /api/ordenes/<id>/fase
 * Body: { faseId: string | null }
 *
 * Cambiar la fase de la orden dentro de su estado actual (0050_fase_orden.sql).
 * No es una transición: el estado no se mueve, así que no pasa por
 * transicionar() -- pero solo se acepta una fase activa del MISMO
 * estado en que está la orden. Para llegar a una fase de otro estado,
 * primero se cambia el estado por /api/ordenes/<id>/transicion.
 *
 * Queda en orden_evento con de_estado = a_estado y el nombre de la fase
 * anterior y la nueva como snapshot.
 */
import { NextResponse } from "next/server";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { faseValidaPara } from "@/lib/fases";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { faseId?: string | null };
  if (body.faseId === undefined) {
    return NextResponse.json({ error: "falta faseId" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "diagnosticar")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data: orden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, fase_id, fase:fase_id ( nombre )")
    .eq("id", id)
    .maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  let fase: { id: string; nombre: string } | null = null;
  if (body.faseId) {
    const { data } = await supabase
      .from("fase_orden")
      .select("id, empresa_id, estado, nombre, activo")
      .eq("id", body.faseId)
      .maybeSingle();
    if (!data || data.empresa_id !== orden.empresa_id) {
      return NextResponse.json({ error: "la fase no existe" }, { status: 404 });
    }
    if (!faseValidaPara(data as { estado: Estado; activo: boolean }, orden.estado as Estado)) {
      const etiqueta = ETIQUETA_ESTADO[data.estado as Estado] ?? data.estado;
      return NextResponse.json(
        {
          error: data.activo
            ? `La fase "${data.nombre}" es de "${etiqueta}" y la orden está en "${ETIQUETA_ESTADO[orden.estado as Estado]}". Cambie primero el estado de la orden.`
            : `La fase "${data.nombre}" está desactivada.`,
        },
        { status: 409 },
      );
    }
    fase = { id: data.id, nombre: data.nombre };
  }

  if ((fase?.id ?? null) === orden.fase_id) {
    return NextResponse.json({ ok: true, faseId: orden.fase_id });
  }

  const { error: errUpdate } = await supabase
    .from("orden")
    .update({ fase_id: fase?.id ?? null })
    .eq("id", id);
  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  // El join de Supabase infiere `fase` como arreglo aunque la relación
  // sea 1:1 -- mismo caso que lib/perfil.ts.
  const faseAnterior = orden.fase as unknown as { nombre: string } | null;
  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: orden.estado,
    de_fase: faseAnterior?.nombre ?? null,
    a_fase: fase?.nombre ?? null,
    autor_id: perfil.id,
  });

  return NextResponse.json({ ok: true, faseId: fase?.id ?? null, faseNombre: fase?.nombre ?? null });
}
