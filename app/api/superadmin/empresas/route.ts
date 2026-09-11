/**
 * GET /api/superadmin/empresas -- lista todas las empresas de la
 * plataforma, con cuántos usuarios y sedes tiene cada una. Cruza el
 * aislamiento normal a propósito: por eso usa clienteAdmin()
 * (service_role, se salta RLS) DESPUÉS de confirmar que quien pregunta
 * es un superadmin de verdad -- nunca antes.
 *
 * POST /api/superadmin/empresas -- da de alta una empresa nueva: la
 * empresa, su primera sede, y su primer usuario admin (vía la Auth
 * Admin API, la misma que /usuarios necesitaría si algún día deja de
 * depender del panel de Supabase). Si la creación del usuario de Auth
 * falla, se revierte lo ya insertado -- no debe quedar una empresa
 * fantasma sin nadie que pueda entrar a administrarla.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";

export async function GET() {
  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);
  if (!superadmin) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const admin = clienteAdmin();
  const { data: empresas, error } = await admin
    .from("empresa")
    .select("id, nombre, nit, activa, creada_en")
    .order("creada_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [{ data: perfiles }, { data: sedes }] = await Promise.all([
    admin.from("perfil").select("empresa_id"),
    admin.from("sede").select("empresa_id"),
  ]);

  const contar = (filas: { empresa_id: string }[] | null, id: string) =>
    (filas ?? []).filter((f) => f.empresa_id === id).length;

  const resultado = (empresas ?? []).map((e) => ({
    ...e,
    usuarios: contar(perfiles, e.id),
    sedes: contar(sedes, e.id),
  }));

  return NextResponse.json(resultado);
}

interface CuerpoEmpresa {
  nombreEmpresa: string;
  nit?: string;
  nombreSede: string;
  sedeTipo?: "tienda" | "taller";
  adminNombre: string;
  adminCorreo: string;
  adminClave: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as CuerpoEmpresa;

  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);
  if (!superadmin) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  if (!body.nombreEmpresa?.trim() || !body.nombreSede?.trim()) {
    return NextResponse.json({ error: "falta el nombre de la empresa o de la sede" }, { status: 400 });
  }
  if (!body.adminNombre?.trim() || !body.adminCorreo?.trim() || !body.adminClave || body.adminClave.length < 8) {
    return NextResponse.json(
      { error: "falta el admin inicial, o la contraseña tiene menos de 8 caracteres" },
      { status: 400 },
    );
  }

  const admin = clienteAdmin();

  const { data: empresa, error: errEmpresa } = await admin
    .from("empresa")
    .insert({ nombre: body.nombreEmpresa.trim(), nit: body.nit?.trim() || null })
    .select("id, nombre")
    .single();
  if (errEmpresa || !empresa) {
    return NextResponse.json({ error: errEmpresa?.message ?? "no se pudo crear la empresa" }, { status: 500 });
  }

  const { data: sede, error: errSede } = await admin
    .from("sede")
    .insert({ empresa_id: empresa.id, nombre: body.nombreSede.trim(), tipo: body.sedeTipo ?? "tienda" })
    .select("id")
    .single();
  if (errSede || !sede) {
    await admin.from("empresa").delete().eq("id", empresa.id);
    return NextResponse.json({ error: errSede?.message ?? "no se pudo crear la sede" }, { status: 500 });
  }

  const { data: usuarioAuth, error: errAuth } = await admin.auth.admin.createUser({
    email: body.adminCorreo.trim(),
    password: body.adminClave,
    email_confirm: true,
  });
  if (errAuth || !usuarioAuth.user) {
    await admin.from("empresa").delete().eq("id", empresa.id); // el delete de sede es en cascada
    return NextResponse.json(
      { error: errAuth?.message ?? "no se pudo crear el usuario administrador" },
      { status: 500 },
    );
  }

  const { error: errPerfil } = await admin.from("perfil").insert({
    id: usuarioAuth.user.id,
    empresa_id: empresa.id,
    sede_id: sede.id,
    nombre: body.adminNombre.trim(),
    rol: "admin",
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(usuarioAuth.user.id);
    await admin.from("empresa").delete().eq("id", empresa.id);
    return NextResponse.json({ error: errPerfil.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    empresa: { id: empresa.id, nombre: empresa.nombre },
    admin: { correo: body.adminCorreo.trim() },
  });
}
