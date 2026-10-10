/**
 * PATCH /api/superadmin/sedes/<id>
 * Body: { nombre?, tipo? }
 * Renombrar una sede o cambiarle el tipo, desde fuera de la empresa.
 *
 * DELETE /api/superadmin/sedes/<id>
 * Misma regla que /api/sedes/[id] (el admin de la empresa): solo se
 * borra una sede sin historial, y nunca la única de su empresa.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { mensajeSedeConHistorial } from "@/lib/sede-historial";

async function exigirSuperadmin() {
  const supabase = await clienteServidor();
  return obtenerSuperadminActual(supabase);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { nombre?: string; tipo?: string };

    if (!(await exigirSuperadmin())) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const cambios: Record<string, string> = {};
    if (body.nombre !== undefined) {
      if (typeof body.nombre !== "string" || !body.nombre.trim()) {
        return NextResponse.json({ error: "falta el nombre de la sede" }, { status: 400 });
      }
      cambios.nombre = body.nombre.trim();
    }
    if (body.tipo !== undefined) {
      if (body.tipo !== "tienda" && body.tipo !== "taller") {
        return NextResponse.json({ error: "el tipo debe ser 'tienda' o 'taller'" }, { status: 400 });
      }
      cambios.tipo = body.tipo;
    }
    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "no hay nada que cambiar" }, { status: 400 });
    }

    const { data, error } = await clienteAdmin().from("sede").update(cambios).eq("id", id).select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "la sede no existe" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado actualizando la sede" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!(await exigirSuperadmin())) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const admin = clienteAdmin();
    const { data: sede, error: errSede } = await admin.from("sede").select("empresa_id").eq("id", id).maybeSingle();
    if (errSede) {
      return NextResponse.json({ error: errSede.message }, { status: 500 });
    }
    if (!sede) {
      return NextResponse.json({ error: "la sede no existe" }, { status: 404 });
    }

    const { count } = await admin
      .from("sede")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", sede.empresa_id);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "No se puede eliminar la única sede de la empresa." }, { status: 409 });
    }

    const { error } = await admin.from("sede").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({ error: await mensajeSedeConHistorial(admin, id) }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado eliminando la sede" },
      { status: 500 },
    );
  }
}
