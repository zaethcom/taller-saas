/**
 * GET /api/repuestos?buscar=<texto>
 * Busca en el catálogo por código o descripción, con la existencia en
 * la sede del usuario -- lo que el técnico consulta antes de consumir
 * un repuesto o de decidir que hace falta marcarlo como faltante.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const buscar = req.nextUrl.searchParams.get("buscar")?.trim() ?? "";

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("sede_id").eq("id", user.id).single();

  let consulta = supabase
    .from("repuesto")
    .select("id, codigo, descripcion, precio_venta, existencia ( cantidad, sede_id )")
    .limit(15);

  if (buscar) {
    consulta = consulta.or(`codigo.ilike.%${buscar}%,descripcion.ilike.%${buscar}%`);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resultado = (data ?? []).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    descripcion: r.descripcion,
    precioVenta: Number(r.precio_venta),
    existenciaAqui: r.existencia.find((e) => e.sede_id === perfil?.sede_id)?.cantidad ?? 0,
  }));

  return NextResponse.json(resultado);
}
