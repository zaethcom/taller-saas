/**
 * POST /api/fases/plantilla -- Body: { plantilla: "celulares" | "patinetas" }
 * Carga con un clic las fases de una plantilla de lib/fases.ts. Se
 * agregan después de las que ya existen y se salta un nombre que ya
 * está activo en el mismo estado, así que cargarla dos veces no
 * duplica nada (filasDePlantilla).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { esPlantilla, filasDePlantilla, type FaseOrden } from "@/lib/fases";

export async function POST(req: Request) {
  const body = (await req.json()) as { plantilla?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "configurar_fases")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!esPlantilla(body.plantilla)) {
    return NextResponse.json({ error: "plantilla inválida" }, { status: 400 });
  }

  const { data: existentes, error: errExistentes } = await supabase
    .from("fase_orden")
    .select("estado, nombre, posicion, activo");
  if (errExistentes) {
    return NextResponse.json({ error: errExistentes.message }, { status: 500 });
  }

  const filas = filasDePlantilla(body.plantilla, (existentes ?? []) as FaseOrden[]);
  if (filas.length === 0) {
    return NextResponse.json({ ok: true, agregadas: 0 });
  }

  const { error } = await supabase
    .from("fase_orden")
    .insert(filas.map((f) => ({ ...f, empresa_id: perfil.empresaId })));
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, agregadas: filas.length });
}
