/**
 * POST /api/etiquetas/vista-previa
 * Body: la plantilla tal como está en el editor (sin guardar todavía).
 * Responde un PNG con exactamente los píxeles que saldrían en la
 * impresora (mismo render que lib/impresion.ts), con datos de muestra.
 * Los avisos del acomodo (no cabe el código, letra muy chica...) van
 * en el encabezado X-Avisos, como JSON codificado en URI.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { DATOS_EJEMPLO, validarPlantilla } from "@/lib/etiquetas/plantilla";
import { pngEtiqueta } from "@/lib/etiquetas/renderizar";
import { marcaParaEtiqueta } from "@/lib/impresion";

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

  // El nombre no importa para dibujar -- se completa si todavía está vacío.
  const validacion = validarPlantilla({ ...body, nombre: (body.nombre as string)?.trim() || "vista previa" });
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }

  const plantilla = validacion.valor;
  const datos = {
    ...DATOS_EJEMPLO[plantilla.uso],
    empresa: perfil.empresaNombre,
    ...(await marcaParaEtiqueta(supabase, perfil.empresaId, plantilla.campos)),
  };
  const { png, avisos } = await pngEtiqueta(plantilla, datos);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Avisos": encodeURIComponent(JSON.stringify(avisos)),
    },
  });
}
