/**
 * POST /api/estacion/vincular   { codigo: "ABCD-EFGH", nombre?: "Android del mostrador" }
 *
 * Lo llama la app Android del puente cuando alguien escribe en ella el
 * código que mostró /sedes. Sin sesión de usuario: el código ES la
 * autorización, por eso vence en 15 minutos y sirve una sola vez.
 *
 * Responde la clave de estación (la misma estacion_credencial que usa la
 * estación de PC) y la sede. Si la sede ya tenía una estación vinculada,
 * esa deja de servir: como «Generar otra clave» en /sedes.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { generarClaveEstacion, hashClave } from "@/lib/estacion-auth";
import { normalizarCodigo } from "@/lib/estacion-codigo";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { codigo?: string; nombre?: string };
  const codigo = normalizarCodigo(body.codigo ?? "");
  if (!codigo) {
    return NextResponse.json({ error: "el código tiene 8 letras o números, como ABCD-EFGH" }, { status: 400 });
  }

  const admin = clienteAdmin();
  const ahora = new Date().toISOString();

  // Marcarlo usado y leerlo en el mismo paso: si dos equipos mandan el
  // mismo código a la vez, solo a uno le devuelve la fila.
  const { data: usado } = await admin
    .from("estacion_codigo")
    .update({ usado_en: ahora })
    .eq("codigo_hash", hashClave(codigo))
    .is("usado_en", null)
    .gt("expira_en", ahora)
    .select("empresa_id, sede_id, creado_por")
    .maybeSingle();

  if (!usado) {
    return NextResponse.json(
      { error: "código inválido o vencido: genera uno nuevo en la página, en Sedes" },
      { status: 404 },
    );
  }

  await admin
    .from("estacion_credencial")
    .update({ revocada_en: ahora })
    .eq("sede_id", usado.sede_id)
    .is("revocada_en", null);

  const clave = generarClaveEstacion();
  const { error } = await admin.from("estacion_credencial").insert({
    empresa_id: usado.empresa_id,
    sede_id: usado.sede_id,
    clave_hash: hashClave(clave),
    nombre: body.nombre?.trim() || "App Android del puente",
    creada_por: usado.creado_por,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: sede } = await admin.from("sede").select("nombre").eq("id", usado.sede_id).single();

  return NextResponse.json({ clave, sedeId: usado.sede_id, sedeNombre: sede?.nombre ?? null });
}
