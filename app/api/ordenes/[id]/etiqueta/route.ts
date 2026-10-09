/**
 * POST /api/ordenes/<id>/etiqueta
 * Vuelve a mandar la etiqueta QR de una orden a la etiquetadora de la
 * sede en la que está trabajando quien la pide -- para cuando la de la
 * recepción no salió, salió mal o se despegó del equipo. Mismo código
 * de entrada que en la recepción (lib/codigo-entrada.ts).
 *
 * Solo encola: no toca el estado de la orden. Cuando la estación la
 * imprime, cuenta para el requisito "tiene_etiqueta" de la transición.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";
import { puede } from "@/lib/permisos";
import { codigoEntrada } from "@/lib/codigo-entrada";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("empresa_id, rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "reimprimir_etiqueta_orden")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const [{ data: orden }, { data: config }] = await Promise.all([
    supabase
      .from("orden")
      .select("numero, empresa_id, producto:producto_id ( tipo, marca, modelo )")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("empresa_config").select("prefijo_etiqueta").eq("empresa_id", perfil.empresa_id).maybeSingle(),
  ]);
  if (!orden || orden.empresa_id !== perfil.empresa_id) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  // El join de Supabase infiere `producto` como arreglo aunque sea 1:1.
  const producto = orden.producto as unknown as { tipo: string; marca: string | null; modelo: string | null } | null;
  const nombreProducto = [producto?.marca, producto?.modelo].filter(Boolean).join(" ") || producto?.tipo || "";

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    tipo: "etiqueta_qr",
    creadoPor: user.id,
    ordenId: id,
    carga: { codigoEntrada: codigoEntrada(config?.prefijo_etiqueta, orden.numero), producto: nombreProducto },
  });

  return NextResponse.json({ ok: true });
}
