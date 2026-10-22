/**
 * GET  /api/repuesto-solicitud
 *      Encargos de mostrador sin entregar de la sede activa, con su
 *      cuenta (valor, pagado, saldo) -- la lista de Compras en Vender.
 * POST /api/repuesto-solicitud
 *      Body: { descripcion, cantidad, prioridad?, clienteId?, clienteNombre,
 *              clienteTelefono, precioVenta?, abono?: { monto, metodoPagoId,
 *              montoRecibido? }, imprimir? }
 *
 * Encargo de mostrador desde Vender: lo que el cliente pide y no hay
 * va a la lista de Compras sin orden, con su nombre y teléfono para
 * saber a quién traérselo (lib/compras/encargo.ts). Con valor puede
 * dejar abono: entra a la caja e imprime su recibo
 * (lib/compras/encargo-servidor.ts). El saldo se cobra al entregarlo
 * (/api/repuesto-solicitud/<id>/entregar).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { validarAbono, type DatosAbono } from "@/lib/abono";
import { cuentaEncargo, normalizarEncargo } from "@/lib/compras/encargo";
import { registrarPagoEncargo } from "@/lib/compras/encargo-servidor";

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let consulta = supabase
    .from("repuesto_solicitud")
    .select("id, descripcion, producto, cantidad, estado, creada_en, cliente_nombre, cliente_telefono, precio_venta, venta ( total, anulada )")
    .is("orden_id", null)
    .is("entregado_en", null)
    .in("estado", ["faltante", "solicitado", "recibido"])
    .order("creada_en", { ascending: false })
    .limit(100);
  if (perfil.sedeId) consulta = consulta.or(`sede_id.is.null,sede_id.eq.${perfil.sedeId}`);
  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((e) => {
      const ventas = (e.venta ?? []) as { total: number; anulada: boolean }[];
      return {
        id: e.id,
        descripcion: e.descripcion,
        producto: e.producto,
        cantidad: e.cantidad,
        llego: e.estado === "recibido",
        creadaEn: e.creada_en,
        clienteNombre: e.cliente_nombre,
        clienteTelefono: e.cliente_telefono,
        ...cuentaEncargo(e.precio_venta, ventas.filter((v) => !v.anulada).map((v) => Number(v.total))),
      };
    }),
  );
}

export async function POST(req: Request) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "vender") && !puede(perfil.rol, "gestionar_compras")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { abono?: DatosAbono; imprimir?: boolean } | null;
  const encargo = normalizarEncargo(body);
  if (!encargo.ok) {
    return NextResponse.json({ error: encargo.error }, { status: 400 });
  }
  const e = encargo.datos;

  // El abono se valida antes de crear nada: sin turno o con un método
  // que no sirve, no queda un encargo a medias.
  const conAbono = Number(body?.abono?.monto) > 0;
  if (conAbono && !e.precioVenta) {
    return NextResponse.json({ error: "Pon el valor del encargo antes del abono" }, { status: 400 });
  }
  if (conAbono && (!puede(perfil.rol, "vender") || !perfil.sedeId)) {
    return NextResponse.json({ error: "No puedes cobrar el abono desde aquí" }, { status: 403 });
  }
  const validacion = conAbono ? await validarAbono(supabase, perfil.sedeId!, body!.abono!, e.precioVenta!) : null;
  if (validacion && !validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: validacion.status });
  }

  const { data, error } = await supabase
    .from("repuesto_solicitud")
    .insert({
      empresa_id: perfil.empresaId,
      orden_id: null,
      sede_id: perfil.sedeId,
      descripcion: e.descripcion,
      cantidad: e.cantidad,
      prioridad: e.prioridad,
      cliente_id: e.clienteId,
      cliente_nombre: e.clienteNombre,
      cliente_telefono: e.clienteTelefono,
      precio_venta: e.precioVenta,
      solicitado_por: perfil.id,
    })
    .select("id, descripcion, producto, cliente_id, cliente_nombre, cliente_telefono, precio_venta")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (validacion?.ok) {
    const r = await registrarPagoEncargo(supabase, {
      pago: validacion.abono,
      encargo: data,
      cuenta: cuentaEncargo(data.precio_venta, []),
      empresaId: perfil.empresaId,
      sedeId: perfil.sedeId!,
      userId: perfil.id,
      cajero: perfil.nombre,
      etiqueta: "ABONO",
      imprimir: body?.imprimir ?? true,
    });
    if (!r.ok) {
      // Sin el abono el encargo no se queda: se vuelve a pedir completo.
      await supabase.from("repuesto_solicitud").delete().eq("id", data.id);
      return NextResponse.json({ error: r.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id, ventaNumero: r.numero });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
