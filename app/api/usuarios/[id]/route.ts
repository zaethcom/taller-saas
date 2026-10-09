/**
 * PATCH /api/usuarios/<id>
 * Body: { codigo: string }
 *
 * El código corto de un cajero o técnico ("C001", "T002") -- lo que se
 * muestra en recibos y reportes en vez de un nombre completo o un uuid.
 * No es una contraseña ni un mecanismo de sesión: la única manera de
 * autenticarse sigue siendo Supabase Auth.
 *
 * DELETE /api/usuarios/<id>
 * Sacar a un usuario de la empresa. Si nunca dejó rastro (ventas,
 * órdenes, eventos, movimientos… apuntan a `perfil` sin cascade), se
 * borra de verdad, perfil y usuario de Auth. Si ya tiene historial, se
 * desactiva: `perfil.activo = false` (obtenerPerfilActual ya lo trata
 * como no autenticado) y se bloquea en Auth para que no pueda volver a
 * iniciar sesión; su nombre sigue en recibos y reportes viejos.
 * Nadie se elimina a sí mismo, y no se elimina al último admin activo.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { codigo?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const codigo = body.codigo?.trim() || null;

  const { error } = await supabase.from("perfil").update({ codigo }).eq("id", id);

  if (error) {
    const mensaje = error.code === "23505" ? "ese código ya está en uso" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true, codigo });
}

/** Bloqueo en Auth para un usuario desactivado: ~100 años. */
const BLOQUEO_INDEFINIDO = "876000h";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (id === perfil.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 409 });
  }

  // Con el cliente de la sesión, RLS solo deja ver perfiles de la misma
  // empresa -- así un admin no puede tocar usuarios de otra.
  const { data: objetivo } = await supabase.from("perfil").select("id, rol, activo").eq("id", id).maybeSingle();
  if (!objetivo || !objetivo.activo) {
    return NextResponse.json({ error: "el usuario no existe" }, { status: 404 });
  }
  if (objetivo.rol === "admin") {
    const { count } = await supabase
      .from("perfil")
      .select("id", { count: "exact", head: true })
      .eq("rol", "admin")
      .eq("activo", true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "No se puede eliminar al único administrador." }, { status: 409 });
    }
  }

  const admin = clienteAdmin();

  const { error: errBorrar } = await admin.from("perfil").delete().eq("id", id);
  if (!errBorrar) {
    const { error: errAuth } = await admin.auth.admin.deleteUser(id);
    if (errAuth) {
      return NextResponse.json({ error: errAuth.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, resultado: "eliminado" });
  }
  if (errBorrar.code !== "23503") {
    return NextResponse.json({ error: errBorrar.message }, { status: 500 });
  }

  // Tiene historial: desactivar en vez de borrar.
  const { error: errDesactivar } = await admin.from("perfil").update({ activo: false }).eq("id", id);
  if (errDesactivar) {
    return NextResponse.json({ error: errDesactivar.message }, { status: 500 });
  }
  const { error: errBloqueo } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEO_INDEFINIDO });
  if (errBloqueo) {
    return NextResponse.json({ error: errBloqueo.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, resultado: "desactivado" });
}
