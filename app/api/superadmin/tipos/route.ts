/**
 * GET /api/superadmin/tipos -- los tipos de empresa (0053), con cuántas
 * empresas tiene asignado cada uno.
 *
 * POST /api/superadmin/tipos
 * Body: { nombre, tipo_equipo?, categorias? }
 * Crea un tipo nuevo. Ver lib/tipos-empresa.ts.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { validarTipo } from "@/lib/tipos-empresa";

export async function GET() {
  try {
    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const admin = clienteAdmin();
    const [{ data: tipos, error }, { data: empresas }] = await Promise.all([
      admin.from("tipo_empresa").select("id, nombre, tipo_equipo, categorias, activo").order("nombre"),
      admin.from("empresa").select("tipo_empresa_id"),
    ]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      (tipos ?? []).map((t) => ({
        ...t,
        empresas: (empresas ?? []).filter((e) => e.tipo_empresa_id === t.id).length,
      })),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado listando los tipos" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const validado = validarTipo(body, { parcial: false });
    if ("error" in validado) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }

    const { data, error } = await clienteAdmin()
      .from("tipo_empresa")
      .insert(validado.campos)
      .select("id")
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      const mensaje = error.code === "23505" ? "ya existe un tipo con ese nombre" : error.message;
      return NextResponse.json({ error: mensaje }, { status });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado creando el tipo" },
      { status: 500 },
    );
  }
}
