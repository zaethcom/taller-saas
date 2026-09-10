/**
 * GET /api/ordenes/por-serial?serial=<serial>
 *
 * Lo que dispara escanear el QR: encuentra la orden activa (la más
 * reciente sin cerrar) de ese producto dentro de la empresa del técnico
 * que hace la consulta. Usa el cliente de servidor con sesión -- RLS
 * filtra por empresa_actual() sin que esta ruta tenga que hacerlo a mano.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get("serial")?.trim();
  if (!serial) {
    return NextResponse.json({ error: "falta el serial" }, { status: 400 });
  }

  const supabase = await clienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: producto, error: errProducto } = await supabase
    .from("producto")
    .select("id")
    .eq("serial", serial)
    .maybeSingle();

  if (errProducto || !producto) {
    return NextResponse.json({ error: "no existe un equipo con ese serial" }, { status: 404 });
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id")
    .eq("producto_id", producto.id)
    .is("cerrada_en", null)
    .order("abierta_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "ese equipo no tiene una orden activa" }, { status: 404 });
  }

  return NextResponse.json({ ordenId: orden.id });
}
