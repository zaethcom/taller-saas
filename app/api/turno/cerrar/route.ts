/**
 * POST /api/turno/cerrar
 * Body: { efectivoContado: number }
 * Cierra el turno abierto de la sede, calcula la diferencia con
 * lib/caja.ts, y encola el comprobante de cierre -- con la firma del
 * responsable, tal como sale en la plantilla de estacion/plantillas/cierre.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { calcularDiferencia, efectivoEsperado } from "@/lib/caja";
import { encolarImpresion } from "@/lib/impresion";
import { clienteServidor } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { efectivoContado?: number };
  if (typeof body.efectivoContado !== "number" || body.efectivoContado < 0) {
    return NextResponse.json({ error: "falta el efectivo contado" }, { status: 400 });
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
    .select("id, base_inicial, abierto_en")
    .eq("sede_id", perfil.sede_id)
    .is("cerrado_en", null)
    .order("abierto_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!turno) {
    return NextResponse.json({ error: "no hay un turno abierto en esta sede" }, { status: 409 });
  }

  const { data: pagos } = await supabase
    .from("pago")
    .select("monto, es_efectivo, venta:venta_id!inner ( turno_id, anulada )")
    .eq("venta.turno_id", turno.id)
    .eq("venta.anulada", false);

  const ventasEfectivo = (pagos ?? [])
    .filter((p) => p.es_efectivo)
    .reduce((s, p) => s + Number(p.monto), 0);
  const totalVentas = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);

  const resumen = {
    baseInicial: Number(turno.base_inicial),
    ventasEfectivo,
    aperturasManualesEfectivo: 0,
  };
  const diferencia = calcularDiferencia(resumen, body.efectivoContado);

  const { error: errCierre } = await supabase
    .from("turno_caja")
    .update({
      cerrado_por: user.id,
      efectivo_contado: body.efectivoContado,
      diferencia,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", turno.id);

  if (errCierre) {
    return NextResponse.json({ error: errCierre.message }, { status: 500 });
  }

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "cierre_caja",
    creadoPor: user.id,
    carga: {
      aperturaEn: new Date(turno.abierto_en).toLocaleString("es-CO"),
      cierreEn: new Date().toLocaleString("es-CO"),
      baseInicial: resumen.baseInicial,
      totalVentas,
      efectivoEsperado: efectivoEsperado(resumen),
      efectivoContado: body.efectivoContado,
      diferencia,
    },
  });

  return NextResponse.json({ ok: true, diferencia });
}
