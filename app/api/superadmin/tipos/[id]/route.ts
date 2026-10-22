/**
 * PATCH /api/superadmin/tipos/<id>
 * Body: { nombre?, tipo_equipo?, categorias?, activo? }
 * Edita el estándar. No toca a las empresas que ya lo recibieron: lo
 * que se les copió es de ellas (0053). Para pasarles lo nuevo, se
 * vuelve a aplicar desde la ficha de cada empresa (solo agrega).
 *
 * DELETE /api/superadmin/tipos/<id>
 * Solo si ninguna empresa lo tiene asignado; si alguna lo tiene, se
 * desactiva en vez de borrarlo.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { validarTipo } from "@/lib/tipos-empresa";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const validado = validarTipo(body, { parcial: true });
    if ("error" in validado) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }
    if (Object.keys(validado.campos).length === 0) {
      return NextResponse.json({ error: "no hay nada que cambiar" }, { status: 400 });
    }

    const { error } = await clienteAdmin().from("tipo_empresa").update(validado.campos).eq("id", id);
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      const mensaje = error.code === "23505" ? "ya existe un tipo con ese nombre" : error.message;
      return NextResponse.json({ error: mensaje }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado guardando el tipo" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const admin = clienteAdmin();
    const { count } = await admin
      .from("empresa")
      .select("id", { count: "exact", head: true })
      .eq("tipo_empresa_id", id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "hay empresas con este tipo: desactívalo en vez de eliminarlo" },
        { status: 409 },
      );
    }

    const { error } = await admin.from("tipo_empresa").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado eliminando el tipo" },
      { status: 500 },
    );
  }
}
