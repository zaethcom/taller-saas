/**
 * PATCH /api/superadmin/usuarios/<id>
 * Body: { nombre?, correo?, clave? }
 * Cambiar el nombre, el correo de inicio de sesión o la contraseña de
 * un usuario de cualquier empresa -- lo típico: el admin de un taller
 * olvidó su clave o quiere entrar con otro correo. Solo toca usuarios
 * que tienen `perfil` (empleados de una empresa), nunca a otro
 * superadmin.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { nombre?: string; correo?: string; clave?: string };

    if (!(await obtenerSuperadminActual(await clienteServidor()))) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }
    if (body.nombre !== undefined && !body.nombre.trim()) {
      return NextResponse.json({ error: "falta el nombre" }, { status: 400 });
    }
    if (body.correo !== undefined && !body.correo.trim()) {
      return NextResponse.json({ error: "falta el correo" }, { status: 400 });
    }
    if (body.clave !== undefined && body.clave.length < 8) {
      return NextResponse.json({ error: "la contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const admin = clienteAdmin();
    const { data: perfil, error: errPerfil } = await admin.from("perfil").select("id").eq("id", id).maybeSingle();
    if (errPerfil) {
      return NextResponse.json({ error: errPerfil.message }, { status: 500 });
    }
    if (!perfil) {
      return NextResponse.json({ error: "el usuario no existe" }, { status: 404 });
    }

    const cambiosAuth: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (body.correo !== undefined) {
      cambiosAuth.email = body.correo.trim();
      cambiosAuth.email_confirm = true;
    }
    if (body.clave !== undefined) cambiosAuth.password = body.clave;
    if (Object.keys(cambiosAuth).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(id, cambiosAuth);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (body.nombre !== undefined) {
      const { error } = await admin.from("perfil").update({ nombre: body.nombre.trim() }).eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado actualizando el usuario" },
      { status: 500 },
    );
  }
}
