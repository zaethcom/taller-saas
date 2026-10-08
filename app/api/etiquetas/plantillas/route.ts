/**
 * GET /api/etiquetas/plantillas -- las plantillas de etiqueta de la
 * empresa (0045), para la sección Etiquetas de /configuracion.
 *
 * POST /api/etiquetas/plantillas
 * Body: { nombre, uso, anchoMm, altoMm, dpi, codigo, campos, fondoUrl?, girar? }
 * Se crea inactiva: activarla es un paso aparte (PATCH { activa: true }),
 * para poder verla e imprimir una prueba antes de que la usen las sedes.
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

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("plantilla_etiqueta")
    .select(COLUMNAS_PLANTILLA)
    .order("uso")
    .order("nombre");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data as FilaPlantilla[]).map(filaAPlantilla));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const validacion = validarPlantilla(body);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("plantilla_etiqueta")
    .insert({ empresa_id: perfil.empresaId, ...plantillaAFila(validacion.valor) })
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
