/**
 * GET /api/sedes
 * Lista las sedes de la empresa -- lo que necesita el selector de
 * "sede destino" al crear un traslado. RLS ya filtra por empresa.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase.from("sede").select("id, nombre, tipo").order("nombre");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
