/**
 * POST /api/repuesto-solicitud
 * Body: { repuestoId, descripcion, cantidad, sedeProveedoraId, ordenId? }
 *
 * El taller le pide un repuesto al almacén. Es el paso que faltaba antes
 * de compras: hasta ahora, no tener existencia en la sede propia obligaba
 * a marcar faltante, que significa comprar algo que la empresa ya tiene
 * en el otro local.
 *
 * ordenId es opcional a propósito (0023): en el mostrador se acaba algo y
 * hay que poder pedirlo sin una reparación detrás.
 *
 * GET /api/repuesto-solicitud?bandeja=recibidas|enviadas
 * recibidas -> lo que me están pidiendo a mí (soy el almacén)
 * enviadas   -> lo que yo pedí y sigo esperando
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { ESTADOS_ABIERTOS } from "@/lib/solicitudes";

const SELECT =
  "id, descripcion, cantidad, prioridad, estado, creada_en, despachado_en, traslado_id, " +
  "repuesto:repuesto_id ( id, codigo, descripcion ), " +
  "orden:orden_id ( numero ), " +
  "solicitante:sede_solicitante_id ( id, nombre ), " +
  "proveedora:sede_proveedora_id ( id, nombre )";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    repuestoId: string;
    descripcion: string;
    cantidad: number;
    sedeProveedoraId: string;
    ordenId?: string;
  };

  if (!body.repuestoId) {
    return NextResponse.json({ error: "falta el repuesto" }, { status: 400 });
  }
  if (!body.sedeProveedoraId) {
    return NextResponse.json({ error: "falta la sede a la que se le pide" }, { status: 400 });
  }
  if (!body.cantidad || body.cantidad < 1) {
    return NextResponse.json({ error: "la cantidad debe ser al menos 1" }, { status: 400 });
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
  if (perfil.sede_id === body.sedeProveedoraId) {
    return NextResponse.json({ error: "no tiene sentido pedirle a la propia sede" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("repuesto_solicitud")
    .insert({
      empresa_id: perfil.empresa_id,
      orden_id: body.ordenId ?? null,
      repuesto_id: body.repuestoId,
      descripcion: body.descripcion,
      cantidad: body.cantidad,
      estado: "pedido_a_sede",
      sede_solicitante_id: perfil.sede_id,
      sede_proveedora_id: body.sedeProveedoraId,
      solicitado_por: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET(req: NextRequest) {
  const bandeja = req.nextUrl.searchParams.get("bandeja");

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("sede_id").eq("id", user.id).single();
  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  let consulta = supabase
    .from("repuesto_solicitud")
    .select(SELECT)
    .in("estado", ESTADOS_ABIERTOS)
    .order("creada_en", { ascending: true });

  if (bandeja === "enviadas") {
    consulta = consulta.eq("sede_solicitante_id", perfil.sede_id);
  } else {
    consulta = consulta.eq("sede_proveedora_id", perfil.sede_id);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
