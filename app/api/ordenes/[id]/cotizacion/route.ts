/**
 * POST /api/ordenes/<id>/cotizacion
 * Body: { items: {descripcion, cantidad, precioUnit, repuestoId?, servicioId?, manoObraId?}[],
 *          manoObra?: number, nota?: string }
 *
 * El técnico termina el diagnóstico y envía la cotización en un solo
 * paso: crea la cotización con sus líneas, y transiciona la orden a
 * esperando_aprobacion usando la misma transicionar() de
 * lib/estados.ts que usa /api/aprobacion -- no hay una segunda
 * llamada por separado porque "enviar cotización" y "mover la orden"
 * son, en la práctica, el mismo evento de negocio.
 *
 * Cada ítem puede venir del catálogo (repuestoId, servicioId o
 * manoObraId -- nunca más de uno) o ser una línea libre sin ninguno,
 * para un cargo puntual que no amerita catálogo. `descripcion` siempre
 * se guarda como snapshot legible, sin importar el origen, porque
 * /seguimiento la muestra tal cual y no debe depender de que el
 * catálogo no cambie después.
 */
import { NextRequest, NextResponse } from "next/server";
import { RequisitoFaltanteError, TransicionInvalidaError, transicionar, type Estado } from "@/lib/estados";
import { clienteServidor } from "@/lib/supabase/servidor";

interface ItemCotizacion {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  repuestoId?: string;
  servicioId?: string;
  manoObraId?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { items?: ItemCotizacion[]; manoObra?: number; nota?: string };

  if (!body.items?.length) {
    return NextResponse.json({ error: "la cotización necesita al menos un ítem" }, { status: 400 });
  }
  const manoObra = body.manoObra ?? 0;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, token_publico")
    .eq("id", id)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const totalItems = body.items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);
  const total = totalItems + manoObra;

  const { data: cotizacion, error: errCotizacion } = await supabase
    .from("cotizacion")
    .insert({
      empresa_id: orden.empresa_id,
      orden_id: id,
      mano_obra: manoObra,
      total,
      estado: "enviada",
      enviada_en: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (errCotizacion || !cotizacion) {
    return NextResponse.json({ error: errCotizacion?.message ?? "no se pudo crear la cotización" }, { status: 500 });
  }

  const { error: errItems } = await supabase.from("cotizacion_item").insert(
    body.items.map((i) => ({
      cotizacion_id: cotizacion.id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unit: i.precioUnit,
      repuesto_id: i.repuestoId ?? null,
      servicio_id: i.servicioId ?? null,
      mano_obra_id: i.manoObraId ?? null,
    })),
  );

  if (errItems) {
    return NextResponse.json({ error: errItems.message }, { status: 500 });
  }

  try {
    transicionar(orden.estado as Estado, "esperando_aprobacion", new Set(["tiene_cotizacion"]));
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      // La cotización ya quedó guardada -- el técnico no pierde el
      // trabajo aunque la orden no estuviera en el estado correcto.
      return NextResponse.json(
        { error: `Cotización guardada, pero no se pudo enviar: ${e.message}` },
        { status: 409 },
      );
    }
    throw e;
  }

  await supabase.from("orden").update({ estado: "esperando_aprobacion" }).eq("id", id);
  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: "esperando_aprobacion",
    autor_id: user.id,
    nota: body.nota?.trim() || undefined,
  });

  return NextResponse.json({
    ok: true,
    cotizacionId: cotizacion.id,
    total,
    urlSeguimiento: `${process.env.NEXT_PUBLIC_APP_URL}/seguimiento/${orden.token_publico}`,
  });
}
