/**
 * POST /api/turno/contar-base
 * Primer paso de abrir turno: abre el cajón para contar la base con la que
 * arranca la caja. Todavía no hay turno, así que la apertura queda en la
 * bitácora apertura_cajon sin turno_id (la columna lo permite) y con su motivo.
 *
 * Existe porque abrir el turno era un solo clic con la base en 0 por defecto:
 * se abría sin contar nada. Ahora la pantalla exige pasar por aquí y escribir
 * la base (aunque sea 0) antes de habilitar «Abrir turno».
 */
import { NextResponse } from "next/server";
import { encolarImpresion } from "@/lib/impresion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

const MOTIVO = "Contar la base para abrir turno";

export async function POST() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "abrir_cajon_manual")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!perfil.sedeId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const { data: yaAbierto } = await supabase
    .from("turno_caja")
    .select("id")
    .eq("sede_id", perfil.sedeId)
    .is("cerrado_en", null)
    .maybeSingle();
  if (yaAbierto) {
    return NextResponse.json({ error: "ya hay un turno abierto en esta sede" }, { status: 409 });
  }

  await supabase.from("apertura_cajon").insert({
    empresa_id: perfil.empresaId,
    sede_id: perfil.sedeId,
    motivo: MOTIVO,
    autor_id: perfil.id,
  });

  await encolarImpresion(supabase, {
    empresaId: perfil.empresaId,
    sedeId: perfil.sedeId,
    tipo: "abrir_cajon",
    creadoPor: perfil.id,
    carga: { motivo: MOTIVO },
  });

  return NextResponse.json({ ok: true });
}
