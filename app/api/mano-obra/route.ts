/**
 * GET /api/mano-obra?buscar=<texto> -- catálogo de mano de obra del
 * taller (punto 8 del documento de requerimientos): precio fijo por
 * tipo de trabajo, igual que un servicio -- no una tarifa por hora.
 * POST /api/mano-obra -- crear un ítem nuevo.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function GET(req: NextRequest) {
  const buscar = req.nextUrl.searchParams.get("buscar")?.trim() ?? "";
  const todos = req.nextUrl.searchParams.get("todos") === "1";

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let consulta = supabase.from("mano_obra").select("id, nombre, precio, activo").order("nombre");

  if (!todos) {
    consulta = consulta.eq("activo", true);
  }
  if (buscar) {
    consulta = consulta.ilike("nombre", `%${buscar}%`);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { nombre?: string; precio?: number };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mano_obra")
    .insert({ empresa_id: perfil.empresaId, nombre: body.nombre.trim(), precio: body.precio ?? 0 })
    .select("id, nombre, precio, activo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
