/**
 * GET /api/ordenes/buscar?numero=<n>
 * Lo que (pos)/entregar usa para encontrar la orden: estado, cotización
 * vigente y saldo pendiente ya calculado con lib/caja.ts, para no
 * repetir esa cuenta en el cliente.
 */
import { NextRequest, NextResponse } from "next/server";
import { saldoPendiente } from "@/lib/caja";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const numero = req.nextUrl.searchParams.get("numero");
  if (!numero) {
    return NextResponse.json({ error: "falta el número de orden" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error } = await supabase
    .from("orden")
    .select(
      `
      id, numero, estado,
      producto:producto_id ( marca, modelo, tipo, serial,
        cliente:cliente_id ( nombre ) )
    `,
    )
    .eq("numero", numero)
    .maybeSingle();

  if (error || !orden) {
    return NextResponse.json({ error: "no existe una orden con ese número" }, { status: 404 });
  }

  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("total")
    .eq("orden_id", orden.id)
    .eq("decision", "aprobada")
    .order("decidida_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: ventas } = await supabase
    .from("venta")
    .select("total")
    .eq("orden_id", orden.id)
    .eq("anulada", false);

  const totalCotizado = Number(cotizacion?.total ?? 0);
  const totalPagado = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);

  return NextResponse.json({
    ...orden,
    saldoPendiente: saldoPendiente(totalCotizado, totalPagado),
    totalCotizado,
  });
}
