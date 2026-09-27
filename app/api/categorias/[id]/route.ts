/**
 * PATCH /api/categorias/<id> -- Body: { nombre }
 * Renombrar una categoría existente. Antes solo se podía crear.
 *
 * DELETE /api/categorias/<id>
 * Eliminarla -- solo si ningún repuesto o artículo la usa todavía
 * (repuesto.categoria_id / articulo.categoria_id no tienen cascade).
 * En vez de dejar pasar el 23503 crudo de Postgres, se devuelve un 409
 * con un mensaje que dice cuántos productos la están usando -- punto 6
 * del documento de requerimientos: "con las validaciones necesarias".
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { nombre?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre de la categoría" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("categoria")
    .update({ nombre: body.nombre.trim() })
    .eq("id", id)
    .select("id, nombre")
    .maybeSingle();

  if (error) {
    const mensaje = error.code === "23505" ? "ya existe una categoría con ese nombre" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "la categoría no existe" }, { status: 404 });
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

  const { error } = await supabase.from("categoria").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      const [{ count: enRepuestos }, { count: enArticulos }] = await Promise.all([
        supabase.from("repuesto").select("id", { count: "exact", head: true }).eq("categoria_id", id),
        supabase.from("articulo").select("id", { count: "exact", head: true }).eq("categoria_id", id),
      ]);
      const total = (enRepuestos ?? 0) + (enArticulos ?? 0);
      return NextResponse.json(
        { error: `No se puede eliminar: está en uso por ${total} producto${total === 1 ? "" : "s"}.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
