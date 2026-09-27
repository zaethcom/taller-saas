/**
 * POST /api/usuarios
 * Body: { nombre, correo, clave, rol, sedeId }
 *
 * Punto 5 del documento de requerimientos: no había ninguna manera de
 * crear un usuario desde la administración -- el único lugar que sabía
 * crear un usuario de Auth + perfil era /api/superadmin/empresas, y solo
 * para el primer admin de una empresa nueva. Mismo patrón acá (Auth
 * Admin API + insertar perfil, revertir si algo falla a mitad de
 * camino), pero `empresa_id` sale SIEMPRE del perfil de quien llama --
 * nunca del cuerpo de la petición -- para que un admin no pueda crear
 * usuarios en otra empresa.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede, type Rol } from "@/lib/permisos";

const ROLES_VALIDOS: Rol[] = ["admin", "recepcion", "tecnico", "compras", "cajero"];

interface CuerpoUsuario {
  nombre: string;
  correo: string;
  clave: string;
  rol: Rol;
  sedeId?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CuerpoUsuario>;

    const supabase = await clienteServidor();
    const perfil = await obtenerPerfilActual(supabase);
    if (!perfil) {
      return NextResponse.json({ error: "no autenticado" }, { status: 401 });
    }
    if (!puede(perfil.rol, "gestionar_usuarios")) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }
    if (!body.nombre?.trim() || !body.correo?.trim()) {
      return NextResponse.json({ error: "falta el nombre o el correo" }, { status: 400 });
    }
    if (!body.clave || body.clave.length < 8) {
      return NextResponse.json({ error: "la contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    if (!body.rol || !ROLES_VALIDOS.includes(body.rol)) {
      return NextResponse.json({ error: "el rol no es válido" }, { status: 400 });
    }

    const admin = clienteAdmin();

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
      empresa_id: perfil.empresaId,
      sede_id: body.sedeId || null,
      nombre: body.nombre.trim(),
      rol: body.rol,
    });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(usuarioAuth.user.id);
      return NextResponse.json({ error: errPerfil.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: usuarioAuth.user.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado creando el usuario" },
      { status: 500 },
    );
  }
}
