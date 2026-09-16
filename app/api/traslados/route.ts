/**
 * POST /api/traslados
 * Body: { sedeDestinoId: string, items: {repuestoId?, articuloId?, descripcion, cantidad}[], nota?: string }
 *
 * Un traslado sale de la sede del usuario hacia sedeDestinoId. Un item
 * de repuesto descuenta cantidad de inmediato (mover_existencia, igual
 * que una venta de mostrador); un item de artículo individualizado
 * pasa esa unidad a 'trasladado' -- en tránsito, ya no vendible ni
 * volvible a trasladar hasta que alguien la reciba. Ninguno de los dos
 * queda "reservado" a la espera de confirmación: la mercancía ya salió
 * físicamente cuando se registra el envío.
 *
 * Lo que sí espera confirmación es lo que pasa en el destino (POST
 * /api/traslados/[id]/recibir): nadie debe poder sumar existencia, ni
 * dar por llegada una unidad, que todavía no tiene en la mano.
 *
 * GET /api/traslados?direccion=entrantes|salientes&estado=enviado
 * Lista los traslados de mi sede en una dirección, para la bandeja de
 * "por recibir" o el historial de "lo que mandé".
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { encolarImpresion } from "@/lib/impresion";

interface ItemTraslado {
  repuestoId?: string;
  articuloId?: string;
  descripcion: string;
  cantidad: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sedeDestinoId: string;
    items: ItemTraslado[];
    nota?: string;
  };

  if (!body.sedeDestinoId) {
    return NextResponse.json({ error: "falta la sede destino" }, { status: 400 });
  }
  if (!body.items?.length) {
    return NextResponse.json({ error: "el traslado no tiene items" }, { status: 400 });
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
  if (perfil.sede_id === body.sedeDestinoId) {
    return NextResponse.json({ error: "la sede destino no puede ser la misma sede" }, { status: 400 });
  }

  if (body.items.some((i) => i.articuloId && i.cantidad !== 1)) {
    return NextResponse.json({ error: "un artículo individualizado se traslada de a una unidad" }, { status: 400 });
  }

  // Descontar en origen ANTES de crear la fila: si algún repuesto no
  // alcanza, o algún artículo ya no está disponible, el traslado no
  // debe quedar registrado a medias. Por eso el movimiento de
  // artículo (a diferencia del de mover_existencia, que audita desde
  // dentro de la función) no puede llevar referencia_id al traslado
  // todavía -- ese id nace después, en el insert de más abajo.
  for (const item of body.items) {
    if (item.repuestoId) {
      const { error: errConsumo } = await supabase.rpc("mover_existencia", {
        p_repuesto_id: item.repuestoId,
        p_sede_id: perfil.sede_id,
        p_delta: -item.cantidad,
        p_tipo: "traslado_envio",
      });
      if (errConsumo) {
        return NextResponse.json(
          { error: `no se pudo descontar "${item.descripcion}": ${errConsumo.message}` },
          { status: 409 },
        );
      }
    } else if (item.articuloId) {
      const { data: articulo } = await supabase
        .from("articulo")
        .update({ estado: "trasladado" })
        .eq("id", item.articuloId)
        .eq("estado", "en_stock")
        .eq("sede_id", perfil.sede_id)
        .select("id")
        .maybeSingle();
      if (!articulo) {
        return NextResponse.json(
          { error: `"${item.descripcion}" ya no está disponible en esta sede` },
          { status: 409 },
        );
      }
      await supabase.from("movimiento_inventario").insert({
        empresa_id: perfil.empresa_id,
        sede_id: perfil.sede_id,
        articulo_id: item.articuloId,
        tipo: "traslado_envio",
        estado_anterior: "en_stock",
        estado_nuevo: "trasladado",
        autor_id: user.id,
      });
    }
  }

  const { data: traslado, error: errTraslado } = await supabase
    .from("traslado")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_origen_id: perfil.sede_id,
      sede_destino_id: body.sedeDestinoId,
      nota: body.nota?.trim() || null,
      enviado_por: user.id,
    })
    .select("id, numero")
    .single();

  if (errTraslado || !traslado) {
    return NextResponse.json({ error: errTraslado?.message ?? "no se pudo crear el traslado" }, { status: 500 });
  }

  await supabase.from("traslado_item").insert(
    body.items.map((i) => ({
      traslado_id: traslado.id,
      repuesto_id: i.repuestoId ?? null,
      articulo_id: i.articuloId ?? null,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
    })),
  );

  const [{ data: sedeOrigen }, { data: sedeDestino }] = await Promise.all([
    supabase.from("sede").select("nombre").eq("id", perfil.sede_id).single(),
    supabase.from("sede").select("nombre").eq("id", body.sedeDestinoId).single(),
  ]);

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "comprobante_traslado",
    creadoPor: user.id,
    carga: {
      numeroTraslado: traslado.numero,
      sedeOrigenNombre: sedeOrigen?.nombre ?? "",
      sedeDestinoNombre: sedeDestino?.nombre ?? "",
      items: body.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad })),
      nota: body.nota?.trim() || null,
      fecha: new Date().toLocaleDateString("es-CO"),
    },
  });

  return NextResponse.json({ ok: true, traslado: { id: traslado.id, numero: traslado.numero } });
}

export async function GET(req: NextRequest) {
  const direccion = req.nextUrl.searchParams.get("direccion"); // "entrantes" | "salientes"
  const estado = req.nextUrl.searchParams.get("estado");

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("sede_id").eq("id", user.id).single();

  let consulta = supabase
    .from("traslado")
    .select(
      "id, numero, estado, nota, enviado_en, recibido_en, sede_origen:sede_origen_id ( nombre ), sede_destino:sede_destino_id ( nombre ), items:traslado_item ( descripcion, cantidad )",
    )
    .order("enviado_en", { ascending: false });

  if (direccion === "entrantes" && perfil?.sede_id) {
    consulta = consulta.eq("sede_destino_id", perfil.sede_id);
  } else if (direccion === "salientes" && perfil?.sede_id) {
    consulta = consulta.eq("sede_origen_id", perfil.sede_id);
  }
  if (estado) {
    consulta = consulta.eq("estado", estado);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
