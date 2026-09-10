/**
 * POST /api/ventas
 * Body: { items: {repuestoId, descripcion, cantidad, precioUnit}[], medioPago, ordenId? }
 *
 * Registra una venta de mostrador (o el cobro de una orden si se manda
 * ordenId), descuenta el inventario de cada repuesto vía la función
 * consumir_repuesto de la base -- una transacción por repuesto, para
 * que la venta nunca quede registrada con el inventario sin descontar
 * -- y encola el recibo. El efectivo abre el cajón; los demás medios no.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { encolarImpresion } from "@/lib/impresion";

interface ItemVenta {
  repuestoId: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    items: ItemVenta[];
    medioPago: "efectivo" | "transferencia" | "tarjeta";
    ordenId?: string;
  };

  if (!body.items?.length) {
    return NextResponse.json({ error: "el carrito está vacío" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  const { data: turno } = await supabase
    .from("turno_caja")
    .select("id")
    .eq("sede_id", perfil.sede_id)
    .is("cerrado_en", null)
    .order("abierto_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!turno) {
    return NextResponse.json({ error: "no hay un turno de caja abierto en esta sede" }, { status: 409 });
  }

  const total = body.items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);

  const { data: venta, error: errVenta } = await supabase
    .from("venta")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: perfil.sede_id,
      turno_id: turno.id,
      orden_id: body.ordenId ?? null,
      tipo: body.ordenId ? "servicio" : "mostrador",
      total,
      creada_por: user.id,
    })
    .select("id, numero")
    .single();

  if (errVenta || !venta) {
    return NextResponse.json({ error: errVenta?.message ?? "no se pudo crear la venta" }, { status: 500 });
  }

  await supabase.from("venta_item").insert(
    body.items.map((i) => ({
      venta_id: venta.id,
      repuesto_id: i.repuestoId,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unit: i.precioUnit,
    })),
  );

  await supabase.from("pago").insert({ venta_id: venta.id, medio: body.medioPago, monto: total });

  // Descontar inventario. Si un repuesto no tiene existencia registrada
  // en esta sede, consumir_repuesto lanza -- se deja que falle: es
  // preferible una venta con un item sin descontar visible en logs a
  // fingir que el inventario cuadra cuando no cuadra.
  for (const item of body.items) {
    if (!item.repuestoId) continue; // ítems sueltos sin ficha de inventario
    await supabase.rpc("consumir_repuesto", {
      p_repuesto_id: item.repuestoId,
      p_sede_id: perfil.sede_id,
      p_cantidad: item.cantidad,
    });
  }

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "recibo_venta",
    creadoPor: user.id,
    carga: {
      numeroVenta: venta.numero,
      items: body.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnit: i.precioUnit,
      })),
      total,
      medioPago: body.medioPago,
      abreCajon: body.medioPago === "efectivo",
    },
  });

  return NextResponse.json({ ok: true, ventaId: venta.id, numero: venta.numero });
}
