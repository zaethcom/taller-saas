/**
 * POST /api/ventas
 * Body: { items: {repuestoId?, articuloId?, descripcion, cantidad, precioUnit}[], medioPago, ordenId? }
 *
 * Registra una venta de mostrador (o el cobro de una orden si se manda
 * ordenId). Cada item sale del inventario de una de dos maneras: un
 * repuesto descuenta cantidad (consumir_repuesto, a granel, se deja
 * fallar después de crear la venta -- ver comentario más abajo); un
 * artículo individualizado (patineta, teléfono) se valida ANTES de
 * crear nada, porque vender dos veces la misma unidad física es un
 * error real, no un descuadre de cantidades que se corrige después.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { encolarImpresion } from "@/lib/impresion";

interface ItemVenta {
  repuestoId?: string;
  articuloId?: string;
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

  const itemsArticulo = body.items.filter((i) => i.articuloId);
  if (itemsArticulo.some((i) => i.cantidad !== 1)) {
    return NextResponse.json({ error: "un artículo individualizado se vende de a una unidad" }, { status: 400 });
  }
  for (const item of itemsArticulo) {
    const { data: articulo } = await supabase
      .from("articulo")
      .select("id")
      .eq("id", item.articuloId)
      .eq("estado", "en_stock")
      .eq("sede_id", perfil.sede_id)
      .maybeSingle();
    if (!articulo) {
      return NextResponse.json(
        { error: `"${item.descripcion}" ya no está disponible en esta sede` },
        { status: 409 },
      );
    }
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
      repuesto_id: i.repuestoId ?? null,
      articulo_id: i.articuloId ?? null,
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
    if (item.repuestoId) {
      await supabase.rpc("consumir_repuesto", {
        p_repuesto_id: item.repuestoId,
        p_sede_id: perfil.sede_id,
        p_cantidad: item.cantidad,
      });
    } else if (item.articuloId) {
      // Ya se validó arriba que estaba en_stock en esta sede -- este
      // guard repite la condición por si algo cambió entre medio.
      await supabase
        .from("articulo")
        .update({ estado: "vendido" })
        .eq("id", item.articuloId)
        .eq("estado", "en_stock")
        .eq("sede_id", perfil.sede_id);
    }
    // si no tiene ninguno de los dos, es un ítem suelto sin ficha de inventario
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
