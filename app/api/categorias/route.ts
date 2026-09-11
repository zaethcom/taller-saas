/**
 * GET /api/categorias -- catálogo de categorías de la empresa, para las
 * pestañas de filtro en /vender y para asignarle una a un artículo al
 * recibirlo.
 * POST /api/categorias -- crear una categoría nueva.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase.from("categoria").select("id, nombre").order("nombre");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
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
    .insert({ empresa_id: perfil.empresaId, nombre: body.nombre.trim() })
    .select("id, nombre")
    .single();

  if (error) {
    const mensaje = error.code === "23505" ? "ya existe una categoría con ese nombre" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json(data);
}
