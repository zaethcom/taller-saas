/**
 * PUT /api/usuarios/<id>/sedes
 * Body: { sedeIds: string[] }
 *
 * A qué sedes puede entrar un usuario (0042_perfil_sede.sql) -- las que
 * le aparecen para escoger al iniciar sesión. Reemplaza la lista
 * completa. Los admin entran a todas las sedes sin necesidad de esto.
 *
 * Si la sede principal del usuario (perfil.sede_id) queda por fuera, la
 * principal pasa a ser la primera de la lista nueva: la principal
 * siempre cuenta como permitida (lib/sede-activa.ts), así que dejarla
 * como estaba haría que quitarla no tuviera efecto.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { sedeIds?: unknown };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!Array.isArray(body.sedeIds) || !body.sedeIds.every((s) => typeof s === "string")) {
    return NextResponse.json({ error: "sedeIds debe ser una lista" }, { status: 400 });
  }
  const sedeIds = [...new Set(body.sedeIds as string[])];

  // RLS ya limita usuario y sedes a la empresa de quien llama: si alguno
  // no aparece aquí, no es de esta empresa (o no existe).
  const [{ data: usuario }, { data: sedes }] = await Promise.all([
    supabase.from("perfil").select("id, sede_id").eq("id", id).maybeSingle(),
    sedeIds.length
      ? supabase.from("sede").select("id").in("id", sedeIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if (!usuario) {
    return NextResponse.json({ error: "usuario no encontrado" }, { status: 404 });
  }
  if ((sedes ?? []).length !== sedeIds.length) {
    return NextResponse.json({ error: "alguna sede no existe" }, { status: 400 });
  }

  const { error: errBorrar } = await supabase.from("perfil_sede").delete().eq("perfil_id", id);
  if (errBorrar) {
    return NextResponse.json({ error: errBorrar.message }, { status: 500 });
  }

  if (sedeIds.length) {
    const { error: errInsertar } = await supabase
      .from("perfil_sede")
      .insert(sedeIds.map((sedeId) => ({ perfil_id: id, sede_id: sedeId, empresa_id: perfil.empresaId })));
    if (errInsertar) {
      return NextResponse.json({ error: errInsertar.message }, { status: 500 });
    }
  }

  if (!usuario.sede_id || !sedeIds.includes(usuario.sede_id)) {
    const { error: errPrincipal } = await supabase
      .from("perfil")
      .update({ sede_id: sedeIds[0] ?? null })
      .eq("id", id);
    if (errPrincipal) {
      return NextResponse.json({ error: errPrincipal.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, sedeIds });
}
