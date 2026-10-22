/**
 * POST /api/repuesto-solicitud/<id>/entregar
 * Body: { metodoPagoId?, montoRecibido?, imprimir? }
 *
 * El encargo de mostrador llegó y el cliente vino por él: se cobra el
 * saldo (venta tipo "encargo" con su recibo, lib/compras/encargo-servidor.ts)
 * y queda entregado. Sin saldo solo se marca entregado.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { validarAbono } from "@/lib/abono";
import { obtenerCuentaEncargo, registrarPagoEncargo } from "@/lib/compras/encargo-servidor";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "vender") || !perfil.sedeId) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { metodoPagoId?: string; montoRecibido?: number; imprimir?: boolean };

  const { data: encargo } = await supabase
    .from("repuesto_solicitud")
    .select("id, orden_id, estado, entregado_en, descripcion, producto, cliente_id, cliente_nombre, cliente_telefono, precio_venta")
    .eq("id", id)
    .maybeSingle();
  if (!encargo || encargo.orden_id) {
    return NextResponse.json({ error: "el encargo no existe" }, { status: 404 });
  }
  if (encargo.entregado_en) {
    return NextResponse.json({ error: "este encargo ya se entregó" }, { status: 409 });
  }
  if (encargo.estado !== "recibido") {
    return NextResponse.json({ error: "el encargo todavía no ha llegado" }, { status: 409 });
  }

  const cuenta = await obtenerCuentaEncargo(supabase, encargo);
  let ventaNumero: number | null = null;
  if (cuenta.saldo > 0) {
    const validacion = await validarAbono(
      supabase,
      perfil.sedeId,
      { monto: cuenta.saldo, metodoPagoId: body.metodoPagoId ?? "", montoRecibido: body.montoRecibido },
      cuenta.saldo,
    );
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: validacion.status });
    }
    const r = await registrarPagoEncargo(supabase, {
      pago: validacion.abono,
      encargo,
      cuenta,
      empresaId: perfil.empresaId,
      sedeId: perfil.sedeId,
      userId: perfil.id,
      cajero: perfil.nombre,
      etiqueta: "SALDO",
      imprimir: body.imprimir ?? true,
    });
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
    ventaNumero = r.numero;
  }

  const { error } = await supabase
    .from("repuesto_solicitud")
    .update({ entregado_en: new Date().toISOString() })
    .eq("id", id)
    .is("entregado_en", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cobrado: cuenta.saldo, ventaNumero });
}
