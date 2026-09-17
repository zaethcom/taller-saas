/**
 * GET /api/sedes
 * Lista las sedes de la empresa -- lo que necesita el selector de
 * "sede destino" al crear un traslado. RLS ya filtra por empresa.
 *
 * POST /api/sedes
 * Da de alta una sede nueva. Sin esto, una empresa que nace con una
 * sola sede (superadmin solo crea una al dar de alta la empresa) no
 * tiene manera de abrir una segunda para poder trasladar entre ellas.
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

  const { data, error } = await supabase.from("sede").select("id, empresa_id, nombre, tipo").order("nombre");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

interface CuerpoSede {
  nombre: string;
  tipo: "tienda" | "taller";
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CuerpoSede>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre de la sede" }, { status: 400 });
  }
  if (body.tipo !== "tienda" && body.tipo !== "taller") {
    return NextResponse.json({ error: "el tipo debe ser 'tienda' o 'taller'" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sede")
    .insert({ empresa_id: perfil.empresaId, nombre: body.nombre.trim(), tipo: body.tipo })
    .select("id, nombre, tipo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
