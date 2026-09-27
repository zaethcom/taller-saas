/**
 * GET /api/ordenes/<id>/diagnostico -- el diagnóstico de la orden, o
 * null si todavía no se ha guardado nada.
 *
 * PATCH /api/ordenes/<id>/diagnostico
 * Body: { hallazgos?, fallas?, observaciones?, recomendaciones? }
 * Upsert -- un diagnóstico por orden (orden_id es unique). Editable
 * solo mientras la orden esté en 'en_diagnostico': una vez que se envía
 * la cotización y la orden avanza, el diagnóstico queda fijo como parte
 * del historial del equipo.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

interface CuerpoDiagnostico {
  hallazgos?: string;
  fallas?: string;
  observaciones?: string;
  recomendaciones?: string;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data } = await supabase
    .from("diagnostico")
    .select("hallazgos, fallas, observaciones, recomendaciones")
    .eq("orden_id", id)
    .maybeSingle();

  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<CuerpoDiagnostico>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "diagnosticar")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data: orden } = await supabase.from("orden").select("estado").eq("id", id).maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }
  if (orden.estado !== "en_diagnostico") {
    return NextResponse.json(
      { error: "el diagnóstico solo se puede editar mientras la orden está en diagnóstico" },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("diagnostico")
    .upsert(
      {
        empresa_id: perfil.empresaId,
        orden_id: id,
        ...(body.hallazgos !== undefined && { hallazgos: body.hallazgos.trim() || null }),
        ...(body.fallas !== undefined && { fallas: body.fallas.trim() || null }),
        ...(body.observaciones !== undefined && { observaciones: body.observaciones.trim() || null }),
        ...(body.recomendaciones !== undefined && { recomendaciones: body.recomendaciones.trim() || null }),
        creado_por: perfil.id,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "orden_id" },
    )
    .select("hallazgos, fallas, observaciones, recomendaciones")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
