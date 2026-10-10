/**
 * GET /api/superadmin/empresas/<id>/usuarios
 * Los usuarios activos de la empresa con su correo de inicio de sesión.
 * El correo vive en Auth, no en `perfil`: por eso se pide a la Auth
 * Admin API usuario por usuario. La contraseña no se puede leer (Auth
 * solo guarda su hash); desde aquí solo se puede poner una nueva.
 *
 * POST /api/superadmin/empresas/<id>/usuarios
 * Body: { nombre, correo, clave }
 * Crea otro administrador para la empresa -- por ejemplo, cuando el
 * dueño perdió el acceso o cambió de encargado. Queda en la primera
 * sede de la empresa, con acceso a todas sus sedes.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";

async function esSuperadmin() {
  return Boolean(await obtenerSuperadminActual(await clienteServidor()));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await esSuperadmin())) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const admin = clienteAdmin();
    const { data: perfiles, error } = await admin
      .from("perfil")
      .select("id, nombre, rol")
      .eq("empresa_id", id)
      .eq("activo", true)
      .order("nombre");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const usuarios = await Promise.all(
      (perfiles ?? []).map(async (p) => {
        const { data } = await admin.auth.admin.getUserById(p.id);
        return { ...p, correo: data.user?.email ?? null };
      }),
    );

    // Primero los admins: son las cuentas que se administran desde aquí.
    usuarios.sort((a, b) => Number(b.rol === "admin") - Number(a.rol === "admin"));
    return NextResponse.json(usuarios);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado listando los usuarios" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { nombre?: string; correo?: string; clave?: string };

    if (!(await esSuperadmin())) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }
    if (!body.nombre?.trim() || !body.correo?.trim()) {
      return NextResponse.json({ error: "falta el nombre o el correo" }, { status: 400 });
    }
    if (!body.clave || body.clave.length < 8) {
      return NextResponse.json({ error: "la contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const admin = clienteAdmin();
    const { data: sedes, error: errSedes } = await admin
      .from("sede")
      .select("id")
      .eq("empresa_id", id)
      .order("nombre");
    if (errSedes) {
      return NextResponse.json({ error: errSedes.message }, { status: 500 });
    }
    if (!sedes || sedes.length === 0) {
      return NextResponse.json({ error: "la empresa no existe o no tiene sedes" }, { status: 404 });
    }

    const { data: usuarioAuth, error: errAuth } = await admin.auth.admin.createUser({
      email: body.correo.trim(),
      password: body.clave,
      email_confirm: true,
    });
    if (errAuth || !usuarioAuth.user) {
      return NextResponse.json({ error: errAuth?.message ?? "no se pudo crear el usuario" }, { status: 500 });
    }

    const { error: errPerfil } = await admin.from("perfil").insert({
      id: usuarioAuth.user.id,
      empresa_id: id,
      sede_id: sedes[0]!.id,
      nombre: body.nombre.trim(),
      rol: "admin",
    });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(usuarioAuth.user.id);
      return NextResponse.json({ error: errPerfil.message }, { status: 500 });
    }

    await admin
      .from("perfil_sede")
      .insert(sedes.map((s) => ({ perfil_id: usuarioAuth.user.id, sede_id: s.id, empresa_id: id })));

    return NextResponse.json({ ok: true, id: usuarioAuth.user.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado creando el usuario" },
      { status: 500 },
    );
  }
}
