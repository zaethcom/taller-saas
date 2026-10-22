/**
 * POST /api/superadmin/empresas/<id>/tipo -- Body: { tipoId }
 * Le asigna a la empresa un tipo (0053) y le copia lo que trae: tipo de
 * equipo por defecto y categorías iniciales. Solo
 * agrega, así que sirve también para volver a aplicar un tipo después
 * de editarlo. Ver aplicarTipoEmpresa en lib/tipos-empresa.ts.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { aplicarTipoEmpresa, type TipoEmpresa } from "@/lib/tipos-empresa";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { tipoId?: string };

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }
    if (typeof body.tipoId !== "string" || !body.tipoId) {
      return NextResponse.json({ error: "falta el tipo de empresa" }, { status: 400 });
    }

    const admin = clienteAdmin();
    const [{ data: empresa }, { data: tipo, error }] = await Promise.all([
      admin.from("empresa").select("id").eq("id", id).maybeSingle(),
      admin.from("tipo_empresa").select("id, tipo_equipo, categorias").eq("id", body.tipoId).maybeSingle(),
    ]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "la empresa no existe" }, { status: 404 });
    }
    if (!tipo) {
      return NextResponse.json({ error: "el tipo de empresa no existe" }, { status: 404 });
    }

    const agregadas = await aplicarTipoEmpresa(admin, id, tipo as TipoEmpresa);
    return NextResponse.json({ ok: true, ...agregadas });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado asignando el tipo" },
      { status: 500 },
    );
  }
}
