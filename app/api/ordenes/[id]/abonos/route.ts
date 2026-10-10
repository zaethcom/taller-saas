/**
 * POST /api/ordenes/<id>/abonos
 * Body: { monto, metodoPagoId, montoRecibido?, imprimir? }
 *
 * Un abono a una orden ya recibida -- el cliente vuelve, se busca la
 * orden por número y deja plata a cuenta (ver (pos)/abonos). Nunca pasa
 * del saldo de la orden (lib/cuenta-orden.ts). Imprime su recibo con el
 * valor de la orden, lo abonado antes y el saldo que queda.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { obtenerCuentaOrden } from "@/lib/cuenta-orden";
import { registrarAbono, validarAbono, type DatosAbono } from "@/lib/abono";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as DatosAbono & { imprimir?: boolean };

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, nombre, codigo")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
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
    cajero: perfil.codigo ? `${perfil.codigo} · ${perfil.nombre}` : perfil.nombre,
    imprimir: body.imprimir ?? true,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ventaId: r.ventaId,
    numero: r.numero,
    saldo: cuenta.saldo - validacion.abono.monto,
  });
}
