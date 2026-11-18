/**
 * POST /api/ordenes/<id>/abonos
 * Body: { monto, metodoPagoId, montoRecibido?, imprimir?, claveLocal?, hechaEn? }
 *
 * Un abono a una orden ya recibida -- el cliente vuelve, se busca la
 * orden por número y deja plata a cuenta (ver (pos)/abonos). Nunca pasa
 * del saldo de la orden (lib/cuenta-orden.ts). Imprime su recibo con el
 * valor de la orden, lo abonado antes y el saldo que queda.
 *
 * claveLocal/hechaEn: abono hecho sin internet que se sube después
 * (plan sin internet, fase 3b). Si ya llegó uno con esa clave se
 * devuelve el mismo, sin registrar ni imprimir otra vez.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { obtenerCuentaOrden } from "@/lib/cuenta-orden";
import { registrarAbono, validarAbono, type DatosAbono } from "@/lib/abono";
import { claveLocalValida, esSubidaSinConexion } from "@/lib/sin-conexion/clave-local";
import { ventaPorClave } from "@/lib/sin-conexion/venta-por-clave";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as DatosAbono & { imprimir?: boolean; claveLocal?: string; hechaEn?: string };

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, nombre")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  let claveLocal = claveLocalValida(body.claveLocal) ? body.claveLocal : null;
  if (claveLocal) {
    const previa = await ventaPorClave(supabase, perfil.empresa_id, claveLocal);
    if (previa === "sin_columna") claveLocal = null;
    else if (previa) return NextResponse.json({ ok: true, ventaId: previa.id, numero: previa.numero, repetida: true });
  }

  const { data: orden } = await supabase.from("orden").select("id, numero, estado").eq("id", id).maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }
  if (orden.estado === "entregada") {
    return NextResponse.json({ error: "esta orden ya se entregó" }, { status: 409 });
  }

  const cuenta = await obtenerCuentaOrden(supabase, id);
  if (!cuenta || cuenta.valor <= 0) {
    return NextResponse.json(
      { error: "la orden todavía no tiene valor: pon el valor del servicio o envía la cotización" },
      { status: 409 },
    );
  }
  if (cuenta.saldo <= 0) {
    return NextResponse.json({ error: "esta orden ya está pagada" }, { status: 409 });
  }

  const validacion = await validarAbono(supabase, sedeActivaId, body, cuenta.saldo);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: validacion.status });
  }

  const r = await registrarAbono(supabase, {
    abono: validacion.abono,
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    userId: user.id,
    ordenId: id,
    numeroOrden: orden.numero,
    valorOrden: cuenta.valor,
    pagadoAntes: cuenta.pagado,
    cajero: perfil.nombre,
    imprimir: body.imprimir ?? true,
    claveLocal,
    hechaEn: body.hechaEn,
    subidaSinConexion: esSubidaSinConexion(body),
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 500 });
  }

  if (r.repetida) return NextResponse.json({ ok: true, ventaId: r.ventaId, numero: r.numero, repetida: true });

  return NextResponse.json({
    ok: true,
    ventaId: r.ventaId,
    numero: r.numero,
    saldo: cuenta.saldo - validacion.abono.monto,
  });
}
