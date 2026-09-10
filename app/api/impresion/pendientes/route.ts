/**
 * GET /api/impresion/pendientes?sede=<id>
 *
 * Lo consulta la estación de impresión de cada sede, cada dos segundos.
 * Requiere Authorization: Bearer <clave de la estación> -- ver
 * lib/estacion-auth.ts. La clave ya identifica la sede; el parámetro
 * ?sede= tiene que coincidir, para que una estación no pueda pedir
 * (por error de configuración) los trabajos de otra sede aunque de
 * alguna forma adivinara su id.
 */
import { NextRequest, NextResponse } from "next/server";
import { verificarEstacion } from "@/lib/estacion-auth";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const identidad = await verificarEstacion(req.headers.get("authorization"));
  if (!identidad) {
    return NextResponse.json({ error: "credencial de estación inválida" }, { status: 401 });
  }

  const sedeSolicitada = req.nextUrl.searchParams.get("sede");
  if (sedeSolicitada !== identidad.sedeId) {
    return NextResponse.json(
      { error: "esta credencial no corresponde a la sede solicitada" },
      { status: 403 },
    );
  }

  const admin = clienteAdmin();
  const { data, error } = await admin
    .from("trabajo_impresion")
    .select("id, tipo, carga")
    .eq("sede_id", identidad.sedeId)
    .eq("estado", "pendiente")
    .order("creado_en", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
