/**
 * PATCH /api/mano-obra/<id> -- editar un ítem existente.
 * DELETE /api/mano-obra/<id> -- eliminarlo, salvo que ya esté en uso en
 * alguna cotización u orden (captura 23503, mismo patrón que
 * app/api/categorias/[id]/route.ts).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { nombre?: string; precio?: number; activo?: boolean };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (body.nombre !== undefined && !body.nombre.trim()) {
    return NextResponse.json({ error: "el nombre no puede quedar vacío" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mano_obra")
    .update({
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.precio !== undefined && { precio: body.precio }),
      ...(body.activo !== undefined && { activo: body.activo }),
    })
    .eq("id", id)
    .select("id, nombre, precio, activo")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "no existe" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { error } = await supabase.from("mano_obra").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "No se puede eliminar: ya está en uso en una cotización o una orden." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
