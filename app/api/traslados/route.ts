/**
 * POST /api/traslados
 * Body: { sedeDestinoId: string, items: {repuestoId?, articuloId?, descripcion, cantidad}[], nota?: string }
 *
 * Un traslado sale de la sede del usuario hacia sedeDestinoId. Un item
 * de repuesto descuenta cantidad de inmediato (consumir_repuesto, igual
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
import { crearTraslado, type ItemTraslado } from "@/lib/traslados";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    sedeDestinoId: string;
    items: ItemTraslado[];
    nota?: string;
  };

  if (!body.sedeDestinoId) {
    return NextResponse.json({ error: "falta la sede destino" }, { status: 400 });
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

  // El trabajo de verdad -- descontar, registrar e imprimir -- vive en
  // lib/traslados.ts, porque el despacho de una solicitud del taller crea
  // exactamente el mismo traslado por otro camino.
  const resultado = await crearTraslado(supabase, {
    empresaId: perfil.empresa_id,
    sedeOrigenId: perfil.sede_id,
    sedeDestinoId: body.sedeDestinoId,
    items: body.items ?? [],
    nota: body.nota,
    enviadoPor: user.id,
  });

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.estado });
  }

  return NextResponse.json({ ok: true, traslado: { id: resultado.id, numero: resultado.numero } });
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
