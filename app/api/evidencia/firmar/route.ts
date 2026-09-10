/**
 * POST /api/evidencia/firmar
 * Body: { ruta: string }
 *
 * Genera una URL firmada de 5 minutos para una foto o video del bucket
 * privado 'evidencia'. La aplicación nunca sirve evidencia por URL
 * pública ni de larga vida -- ver supabase/migrations/0007_storage.sql.
 *
 * Usa el cliente de servidor con la sesión del usuario (no service
 * role): las políticas de storage.objects filtran por empresa_actual(),
 * así que un usuario de otra empresa recibe error aunque adivine la ruta.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

const SEGUNDOS_VALIDEZ = 5 * 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { ruta?: string };
  if (!body.ruta) {
    return NextResponse.json({ error: "falta la ruta" }, { status: 400 });
  }

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase.storage
    .from("evidencia")
    .createSignedUrl(body.ruta, SEGUNDOS_VALIDEZ);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "no se pudo firmar" }, { status: 403 });
  }

  return NextResponse.json({ url: data.signedUrl, expiraEn: SEGUNDOS_VALIDEZ });
}
