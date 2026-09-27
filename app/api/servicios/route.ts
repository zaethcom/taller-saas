/**
 * GET /api/servicios?buscar=<texto> -- catálogo de servicios del taller
 * (punto 7 del documento de requerimientos), para que el técnico elija
 * en vez de escribir cada línea de la cotización a mano.
 * POST /api/servicios -- crear un servicio nuevo.
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

  let consulta = supabase
    .from("servicio")
    .select("id, codigo, nombre, descripcion, precio, costo_estimado, tiempo_estimado_minutos, activo")
    .order("nombre");

  if (!todos) {
    consulta = consulta.eq("activo", true);
  }
  if (buscar) {
    consulta = consulta.or(`nombre.ilike.%${buscar}%,codigo.ilike.%${buscar}%`);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

interface CuerpoServicio {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  precio?: number;
  costoEstimado?: number;
  tiempoEstimadoMinutos?: number;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CuerpoServicio>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre del servicio" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("servicio")
    .insert({
      empresa_id: perfil.empresaId,
      codigo: body.codigo?.trim() || null,
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      precio: body.precio ?? 0,
      costo_estimado: body.costoEstimado ?? null,
      tiempo_estimado_minutos: body.tiempoEstimadoMinutos ?? null,
    })
    .select("id, codigo, nombre, descripcion, precio, costo_estimado, tiempo_estimado_minutos, activo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
