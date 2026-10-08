/**
 * POST /api/etiquetas/plantillas/<id>/prueba
 * Encola una etiqueta de muestra con esta plantilla (activa o no) en la
 * impresora de etiquetas de la sede en la que está trabajando quien la
 * pide -- para ver en el rollo real si la medida y la orientación
 * coinciden antes de activarla.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { encolarImpresion } from "@/lib/impresion";
import { COLUMNAS_PLANTILLA, DATOS_EJEMPLO, filaAPlantilla, type FilaPlantilla } from "@/lib/etiquetas/plantilla";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!perfil.sedeId) {
    return NextResponse.json({ error: "elija primero en qué sede está trabajando" }, { status: 400 });
  }

  const { data: fila } = await supabase.from("plantilla_etiqueta").select(COLUMNAS_PLANTILLA).eq("id", id).maybeSingle();
  if (!fila) {
    return NextResponse.json({ error: "la plantilla no existe" }, { status: 404 });
  }
  const plantilla = filaAPlantilla(fila as FilaPlantilla);
  const ejemplo = { ...DATOS_EJEMPLO[plantilla.uso], empresa: perfil.empresaNombre };

  const comun = { empresaId: perfil.empresaId, sedeId: perfil.sedeId, creadoPor: perfil.id, plantillaEtiqueta: plantilla };
  if (plantilla.uso === "orden") {
    await encolarImpresion(supabase, {
      ...comun,
      tipo: "etiqueta_qr",
      carga: { codigoEntrada: ejemplo.codigo, producto: ejemplo.descripcion },
    });
  } else if (plantilla.uso === "articulo") {
    await encolarImpresion(supabase, {
      ...comun,
      tipo: "etiqueta_articulo",
      carga: { codigo: ejemplo.codigo, tipo: "prueba", marca: ejemplo.descripcion ?? null, modelo: null },
    });
  } else {
    await encolarImpresion(supabase, {
      ...comun,
      tipo: "etiqueta_repuesto",
      carga: {
        nombreEmpresa: perfil.empresaNombre,
        codigo: ejemplo.codigo,
        descripcion: ejemplo.descripcion ?? "",
        cantidadCopias: 1,
      },
    });
  }

  return NextResponse.json({ ok: true, sede: perfil.sedeNombre });
}
