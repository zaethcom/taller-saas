/**
 * POST /api/push   Body: la PushSubscription del navegador (toJSON())
 * DELETE /api/push Body: { endpoint }
 *
 * Guarda o borra el equipo que recibe los avisos del cliente como
 * notificación push (push_suscripcion, 0061_avisos_cliente.sql). La
 * sede es la activa en este equipo: solo le llegan los de esa sede.
 */
import { NextRequest, NextResponse } from "next/server";
import { veAvisos } from "@/lib/avisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

interface SuscripcionNavegador {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as SuscripcionNavegador;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "suscripción inválida" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!veAvisos(perfil.rol)) {
    return NextResponse.json({ error: "tu rol no recibe avisos de clientes" }, { status: 403 });
  }

  // El mismo navegador puede quedar de otro usuario (equipo compartido):
  // se reemplaza la fila, el endpoint es único.
  await supabase.from("push_suscripcion").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_suscripcion").insert({
    empresa_id: perfil.empresaId,
    perfil_id: perfil.id,
    sede_id: perfil.sedeId,
    endpoint,
    p256dh,
    auth,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof body.endpoint !== "string") {
    return NextResponse.json({ error: "falta el endpoint" }, { status: 400 });
  }
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  await supabase.from("push_suscripcion").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}
