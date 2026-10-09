/**
 * POST /api/sedes/<id>/estacion/codigo
 *
 * Un código corto para vincular la app Android del puente con esta sede
 * (ver lib/estacion-codigo.ts y 0049_codigo_vinculacion.sql). Se escribe
 * en la app; la app lo canjea en POST /api/estacion/vincular y recibe su
 * clave de estación sin que nadie copie archivos.
 *
 * Pedir otro deja sin efecto los que esta sede tuviera sin usar: en
 * pantalla solo hay uno, y es ese el que tiene que servir.
 */
import { NextResponse } from "next/server";
import { clienteServidor, clienteAdmin } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { hashClave } from "@/lib/estacion-auth";
import { generarCodigoVinculacion, normalizarCodigo, VIGENCIA_CODIGO_MS } from "@/lib/estacion-codigo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  // Igual que en ../route.ts: estacion_codigo se escribe con el cliente de
  // servicio, así que la sede se busca con el del usuario -- si RLS no se
  // la muestra, no es de su empresa.
  const { data: sede } = await supabase.from("sede").select("id").eq("id", id).maybeSingle();
  if (!sede) {
    return NextResponse.json({ error: "la sede no existe" }, { status: 404 });
  }

  const admin = clienteAdmin();
  const ahora = new Date();

  await admin
    .from("estacion_codigo")
    .update({ expira_en: ahora.toISOString() })
    .eq("sede_id", id)
    .is("usado_en", null)
    .gt("expira_en", ahora.toISOString());

  const codigo = generarCodigoVinculacion();
  const expiraEn = new Date(ahora.getTime() + VIGENCIA_CODIGO_MS).toISOString();

  const { error } = await admin.from("estacion_codigo").insert({
    empresa_id: perfil.empresaId,
    sede_id: id,
    codigo_hash: hashClave(normalizarCodigo(codigo)!),
    creado_por: perfil.id,
    expira_en: expiraEn,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codigo, expiraEn });
}
