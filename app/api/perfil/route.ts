/**
 * GET /api/perfil
 * El perfil del usuario autenticado -- lo consulta el login para saber
 * a dónde redirigir según el rol, y cualquier pantalla que necesite
 * mostrar quién es el usuario actual.
 */
import { NextResponse } from "next/server";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  if (!perfil) {
    return NextResponse.json({ error: "no autenticado o usuario deshabilitado" }, { status: 401 });
  }

  return NextResponse.json(perfil);
}
