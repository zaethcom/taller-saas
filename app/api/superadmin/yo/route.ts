/**
 * GET /api/superadmin/yo
 * ¿El usuario autenticado es superadmin? Lo consulta /login cuando
 * /api/perfil falla -- alguien puede no tener perfil en ninguna
 * empresa y aun así ser superadmin de la plataforma.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";

export async function GET() {
  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);
  if (!superadmin) {
    return NextResponse.json({ error: "no es superadmin" }, { status: 401 });
  }
  return NextResponse.json(superadmin);
}
