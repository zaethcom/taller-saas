/**
 * PATCH /api/superadmin/empresas/<id>
 * Body: { activa: boolean }
 * Suspender o reactivar una empresa. empresa_actual() (0020_superadmin.sql)
 * exige empresa.activa -- en cuanto esto se guarda en false, ningún
 * usuario de esa empresa vuelve a ver nada por RLS, en toda la
 * aplicación, sin que ninguna pantalla tenga que acordarse de revisarlo.
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { activa?: boolean };

  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);
  if (!superadmin) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (typeof body.activa !== "boolean") {
    return NextResponse.json({ error: "falta el estado activa" }, { status: 400 });
  }

  const { error } = await clienteAdmin().from("empresa").update({ activa: body.activa }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
