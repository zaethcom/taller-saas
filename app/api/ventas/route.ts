/**
 * POST /api/ventas
 * Body: { items: {repuestoId?, articuloId?, descripcion, cantidad, precioUnit}[],
 *          metodoPagoId, montoRecibido?, ordenId?, imprimir? }
 *
 * Registra una venta de mostrador (o el cobro de una orden si se manda
 * ordenId). Cada item sale del inventario de una de dos maneras: un
 * repuesto descuenta cantidad (mover_existencia, a granel, se deja
 * fallar después de crear la venta -- ver comentario más abajo); un
 * artículo individualizado (patineta, teléfono) se valida ANTES de
 * crear nada, porque vender dos veces la misma unidad física es un
 * error real, no un descuadre de cantidades que se corrige después.
 *
 * El método de pago ya no es uno de tres valores fijos -- se resuelve
 * contra el catálogo de la empresa (metodo_pago, 0019) y su nombre +
 * es_efectivo quedan grabados en `pago` como snapshot: si el catálogo
 * cambia después, un pago ya hecho no debe cambiar de categoría.
 *
 * GET /api/ventas
 * Los últimos recibos de la sede activa (5 por defecto, ?limite= hasta
 * 20), sin las anuladas, con sus items y medio de pago para poder
 * verlos en /vender sin otra consulta.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";
import { saldoPendiente } from "@/lib/caja";

export async function GET(req: NextRequest) {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const limite = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limite")) || 5, 1), 20);
  const { data, error } = await supabase
    .from("venta")
    .select("id, numero, total, tipo, creada_en, venta_item(descripcion, cantidad, precio_unit), pago(medio)")
    .eq("sede_id", sedeActivaId)
    .eq("anulada", false)
    .order("creada_en", { ascending: false })
    .limit(limite);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((v) => ({
      id: v.id,
      numero: v.numero,
      total: Number(v.total),
      tipo: v.tipo,
      creadaEn: v.creada_en,
      medioPago: (v.pago as { medio: string }[] | null)?.[0]?.medio ?? null,
      items: ((v.venta_item as { descripcion: string; cantidad: number; precio_unit: number }[] | null) ?? []).map(
        (i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: Number(i.precio_unit) }),
      ),
    })),
  );
}

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
    metodoPagoId: string;
    montoRecibido?: number;
    ordenId?: string;
    imprimir?: boolean;
  };

  if (!body.items?.length) {
    return NextResponse.json({ error: "el carrito está vacío" }, { status: 400 });
  }
  if (!body.metodoPagoId) {
    return NextResponse.json({ error: "falta el método de pago" }, { status: 400 });
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
    .select("empresa_id, sede_id, nombre, codigo")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);

  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const { data: metodo } = await supabase
    .from("metodo_pago")
    .select("nombre, es_efectivo")
    .eq("id", body.metodoPagoId)
    .eq("activo", true)
    .maybeSingle();
  if (!metodo) {
    return NextResponse.json({ error: "método de pago inválido" }, { status: 400 });
  }

  const { data: turno } = await supabase
    .from("turno_caja")
    .select("id")
    .eq("sede_id", sedeActivaId)
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
      .eq("sede_id", sedeActivaId)
      .maybeSingle();
    if (!articulo) {
      return NextResponse.json(
        { error: `"${item.descripcion}" ya no está disponible en esta sede` },
        { status: 409 },
      );
    }
  }

  const total = body.items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);

  // Cobrar una orden nunca puede pasar de su saldo pendiente. Sin esto,
  // reintentar una entrega que falló después de cobrar volvía a cobrar
  // la orden completa cada vez (la orden #14 quedó cobrada tres veces).
  if (body.ordenId) {
    const { data: orden } = await supabase.from("orden").select("total").eq("id", body.ordenId).maybeSingle();
    if (!orden) {
      return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
    }
    const { data: ventasOrden } = await supabase
      .from("venta")
      .select("total")
      .eq("orden_id", body.ordenId)
      .eq("anulada", false);
    const pagado = (ventasOrden ?? []).reduce((s, v) => s + Number(v.total), 0);
    const pendiente = saldoPendiente(Number(orden.total), pagado);
    if (pendiente === 0) {
      return NextResponse.json({ error: "esta orden ya está pagada" }, { status: 409 });
    }
    if (total > pendiente) {
      return NextResponse.json(
        { error: `el cobro supera el saldo pendiente de la orden ($${Math.round(pendiente).toLocaleString("es-CO")})` },
        { status: 409 },
      );
    }
  }

  if (metodo.es_efectivo && (body.montoRecibido ?? 0) < total) {
    return NextResponse.json({ error: "el efectivo recibido no alcanza el total" }, { status: 400 });
  }

  const { data: venta, error: errVenta } = await supabase
    .from("venta")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: sedeActivaId,
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

  await supabase.from("pago").insert({
    venta_id: venta.id,
    medio: metodo.nombre,
    monto: total,
    es_efectivo: metodo.es_efectivo,
    metodo_pago_id: body.metodoPagoId,
  });

  // Descontar inventario. Si un repuesto no tiene existencia registrada
  // en esta sede, mover_existencia lanza -- se deja que falle: es
  // preferible una venta con un item sin descontar visible en logs a
  // fingir que el inventario cuadra cuando no cuadra.
  //
  // Cuando la venta trae ordenId, los items son orden_item (Fase 5 del
  // Plan 1): ya se descontaron del inventario en el momento en que el
  // técnico los consumió (POST /api/ordenes/[id]/repuestos, acción
  // "consumir") -- esto solo cobra lo que ya se usó, no debe volver a
  // mover existencia o se descuenta dos veces.
  for (const item of body.items) {
    if (item.repuestoId && !body.ordenId) {
      await supabase.rpc("mover_existencia", {
        p_repuesto_id: item.repuestoId,
        p_sede_id: sedeActivaId,
        p_delta: -item.cantidad,
        p_tipo: "venta",
        p_referencia_id: venta.id,
      });
    } else if (item.articuloId) {
      // Ya se validó arriba que estaba en_stock en esta sede -- este
      // guard repite la condición por si algo cambió entre medio.
      const { data: articuloVendido } = await supabase
        .from("articulo")
        .update({ estado: "vendido" })
        .eq("id", item.articuloId)
        .eq("estado", "en_stock")
        .eq("sede_id", sedeActivaId)
        .select("id")
        .maybeSingle();
      if (articuloVendido) {
        await supabase.from("movimiento_inventario").insert({
          empresa_id: perfil.empresa_id,
          sede_id: sedeActivaId,
          articulo_id: item.articuloId,
          tipo: "venta",
          estado_anterior: "en_stock",
          estado_nuevo: "vendido",
          autor_id: user.id,
          referencia_id: venta.id,
        });
      }
    }
    // si no tiene ninguno de los dos, es un ítem suelto sin ficha de inventario
  }

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
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
      medioPago: metodo.nombre,
      abreCajon: metodo.es_efectivo,
      cajero: perfil.codigo ? `${perfil.codigo} · ${perfil.nombre}` : perfil.nombre,
      montoRecibido: metodo.es_efectivo ? body.montoRecibido ?? null : null,
      cambio: metodo.es_efectivo && body.montoRecibido ? body.montoRecibido - total : null,
      imprimir: body.imprimir ?? true,
    },
  });

  return NextResponse.json({ ok: true, ventaId: venta.id, numero: venta.numero });
}
