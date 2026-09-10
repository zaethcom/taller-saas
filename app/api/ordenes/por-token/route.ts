/**
 * GET /api/ordenes/por-token?token=<token_publico>
 *
 * El QR que se imprime en la etiqueta (ver app/api/ordenes/route.ts)
 * codifica la URL de seguimiento completa -- .../seguimiento/<token> --
 * no el serial. Eso es a propósito: cualquiera que escanee la
 * etiqueta con la cámara del celular (no solo el técnico dentro de
 * esta app) cae directo en el seguimiento público.
 *
 * Pero el técnico necesita algo distinto al escanear desde /escanear:
 * abrir la orden dentro de la app, con sesión, viendo lo que
 * orden_para_tecnico le permite ver. Esta ruta resuelve el token a un
 * id de orden, respetando RLS -- solo encuentra la orden si es de la
 * empresa del técnico.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "falta el token" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error } = await supabase
    .from("orden")
    .select("id")
    .eq("token_publico", token)
    .maybeSingle();

  if (error || !orden) {
    return NextResponse.json({ error: "no se encontró una orden para ese código" }, { status: 404 });
  }

  return NextResponse.json({ ordenId: orden.id });
}
