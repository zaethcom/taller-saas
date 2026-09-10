/**
 * POST /api/impresion/<id>/resultado
 * Body: { ok: true } | { ok: false, error: string }
 *
 * La estación reporta si el trabajo se imprimió. Un error no lo saca
 * de la cola por completo -- marcar_resultado_impresion (en la base)
 * lo reintenta hasta 5 veces antes de marcarlo como 'error' definitivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { verificarEstacion } from "@/lib/estacion-auth";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identidad = await verificarEstacion(req.headers.get("authorization"));
  if (!identidad) {
    return NextResponse.json({ error: "credencial de estación inválida" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { ok: boolean; error?: string };

  const admin = clienteAdmin();

  // Confirmar que el trabajo es de la sede de esta estación antes de
  // tocarlo -- una clave válida de la sede A no debe poder marcar
  // trabajos de la sede B, así se equivoque el que escribió el cliente.
  const { data: trabajo } = await admin
    .from("trabajo_impresion")
    .select("sede_id")
    .eq("id", id)
    .single();

  if (!trabajo || trabajo.sede_id !== identidad.sedeId) {
    return NextResponse.json({ error: "trabajo no encontrado en esta sede" }, { status: 404 });
  }

  const { error } = await admin.rpc("marcar_resultado_impresion", {
    p_id: id,
    p_ok: body.ok,
    p_error: body.ok ? null : (body.error ?? "error desconocido"),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
