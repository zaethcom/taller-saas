/**
 * GET /api/turno/actual
 * El turno abierto de la sede del usuario, con el resumen en vivo que
 * usa lib/caja.ts -- lo que se ve en (pos)/turno mientras el turno
 * sigue abierto, y lo que /api/turno/cerrar recalcula al cerrar.
 */
import { NextResponse } from "next/server";
import { efectivoEsperado } from "@/lib/caja";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("sede_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  const { data: turno } = await supabase
    .from("turno_caja")
    .select("id, base_inicial, abierto_en")
    .eq("sede_id", perfil.sede_id)
    .is("cerrado_en", null)
    .order("abierto_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!turno) {
    return NextResponse.json({ abierto: false });
  }

  const { data: pagos } = await supabase
    .from("pago")
    .select("monto, medio, venta:venta_id!inner ( turno_id, anulada )")
    .eq("venta.turno_id", turno.id)
    .eq("venta.anulada", false);

  const ventasEfectivo = (pagos ?? [])
    .filter((p) => p.medio === "efectivo")
    .reduce((s, p) => s + Number(p.monto), 0);
  const totalVentas = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);

  return NextResponse.json({
    abierto: true,
    turnoId: turno.id,
    baseInicial: Number(turno.base_inicial),
    abiertoEn: turno.abierto_en,
    ventasEfectivo,
    totalVentas,
    efectivoEsperado: efectivoEsperado({
      baseInicial: Number(turno.base_inicial),
      ventasEfectivo,
      aperturasManualesEfectivo: 0,
    }),
  });
}
