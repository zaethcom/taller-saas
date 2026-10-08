/**
 * PATCH /api/etiquetas/plantillas/<id>
 * Body: cualquier campo de la plantilla, y/o { activa: true | false }.
 * Activar una desactiva la que estuviera activa para el mismo uso --
 * hay como mucho una por uso (índice parcial de 0045). Desactivarla
 * vuelve a la etiqueta de fábrica.
 *
 * DELETE /api/etiquetas/plantillas/<id>
 * Borrado real: lo ya impreso guarda su propio bitmap (ver 0045).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import {
  COLUMNAS_PLANTILLA,
  filaAPlantilla,
  plantillaAFila,
  validarPlantilla,
  type FilaPlantilla,
} from "@/lib/etiquetas/plantilla";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data: fila } = await supabase.from("plantilla_etiqueta").select(COLUMNAS_PLANTILLA).eq("id", id).maybeSingle();
  if (!fila) {
    return NextResponse.json({ error: "la plantilla no existe" }, { status: 404 });
  }
  const actual = filaAPlantilla(fila as FilaPlantilla);

  // Lo que no viene en el body se queda como está; se valida el resultado completo.
  const { activa, ...cambios } = body;
  const validacion = validarPlantilla({ ...actual, ...cambios });
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }

  const nuevaActiva = typeof activa === "boolean" ? activa : actual.activa;
  if (nuevaActiva) {
    const { error: errOtras } = await supabase
      .from("plantilla_etiqueta")
      .update({ activa: false })
      .eq("uso", validacion.valor.uso)
      .eq("activa", true)
      .neq("id", id);
    if (errOtras) {
      return NextResponse.json({ error: errOtras.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("plantilla_etiqueta")
    .update({ ...plantillaAFila(validacion.valor), activa: nuevaActiva, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNAS_PLANTILLA)
    .single();

  if (error) {
    const duplicada = error.code === "23505";
    return NextResponse.json(
      { error: duplicada ? "ya hay una plantilla con ese nombre para ese uso" : error.message },
      { status: duplicada ? 409 : 500 },
    );
  }

  return NextResponse.json(filaAPlantilla(data as FilaPlantilla));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { error } = await supabase.from("plantilla_etiqueta").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
