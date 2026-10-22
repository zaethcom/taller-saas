/**
 * POST /api/ordenes/<id>/cotizacion
 * Body: { items: {descripcion, cantidad, precioUnit, repuestoId?, servicioId?, manoObraId?}[],
 *          manoObra?: number, nota?: string }
 *
 * Cotizar es opcional: solo cuando hay que pedirle permiso al cliente.
 * Crea la cotización con sus líneas y pasa la orden a
 * esperando_cliente usando la misma transicionar() de
 * lib/estados.ts que usa /api/aprobacion -- no hay una segunda
 * llamada por separado porque "enviar cotización" y "mover la orden"
 * son, en la práctica, el mismo evento de negocio. Si el cliente ya
 * rechazó la anterior, la nueva se envía sin cambiar de estado (sigue
 * esperando al cliente).
 *
 * Cada ítem puede venir del catálogo (repuestoId, servicioId o
 * manoObraId -- nunca más de uno) o ser una línea libre sin ninguno,
 * para un cargo puntual que no amerita catálogo. `descripcion` siempre
 * se guarda como snapshot legible, sin importar el origen, porque
 * /seguimiento la muestra tal cual y no debe depender de que el
 * catálogo no cambie después.
 */
import { NextRequest, NextResponse } from "next/server";
import { RequisitoFaltanteError, TransicionInvalidaError, transicionar } from "@/lib/estados";
import { asignarTecnico } from "@/lib/tecnico-auto";
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

  // Quien cotiza revisó el equipo: queda como su técnico si no tenía.
  const revisada = await asignarTecnico(supabase, id, user.id);
  if ("error" in revisada) {
    return NextResponse.json({ error: revisada.error }, { status: 409 });
  }
  const estadoActual = revisada.estado;

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, token_publico")
    .eq("id", id)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  // Antes de guardar nada: una cotización que no se puede enviar no se
  // guarda como "enviada" (contaría en la cuenta de la orden sin que el
  // cliente la haya visto).
  // Ya esperando al cliente: solo se le manda otra si rechazó la anterior.
  const recotiza = estadoActual === "esperando_cliente";
  if (recotiza) {
    const { data: anterior } = await supabase
      .from("cotizacion")
      .select("decision")
      .eq("orden_id", id)
      .order("enviada_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior && anterior.decision !== "rechazada") {
      return NextResponse.json(
        { error: "Ya hay una cotización esperando la respuesta del cliente." },
        { status: 409 },
      );
    }
  }
  try {
    if (!recotiza) transicionar(estadoActual, "esperando_cliente", new Set(["tiene_cotizacion"]));
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      return NextResponse.json({ error: `No se puede enviar la cotización: ${e.message}` }, { status: 409 });
    }
    throw e;
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
    // Sin sus líneas no es una cotización: no se deja a medias.
    await supabase.from("cotizacion").delete().eq("id", cotizacion.id);
    return NextResponse.json({ error: errItems.message }, { status: 500 });
  }

  if (!recotiza) {
    await supabase.from("orden").update({ estado: "esperando_cliente", fase_id: null }).eq("id", id);
  }
  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: "esperando_cliente",
    autor_id: user.id,
    nota: [recotiza ? "Se envió otra cotización" : null, body.nota?.trim()].filter(Boolean).join(". ") || undefined,
  });

  return NextResponse.json({
    ok: true,
    cotizacionId: cotizacion.id,
    total,
    urlSeguimiento: `${process.env.NEXT_PUBLIC_APP_URL}/seguimiento/${orden.token_publico}`,
  });
}
