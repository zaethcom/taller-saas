/**
 * PATCH /api/metodos-pago/<id>
 * Body: { activo: boolean }
 * Activar/desactivar un método -- nunca se borra uno que ya tenga pagos
 * asociados, porque pago.medio es un snapshot del nombre, no una
 * referencia que se rompería.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { activo?: boolean };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (typeof body.activo !== "boolean") {
    return NextResponse.json({ error: "falta el estado activo" }, { status: 400 });
  }

  const { error } = await supabase.from("metodo_pago").update({ activo: body.activo }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
