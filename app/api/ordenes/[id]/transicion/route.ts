/**
 * POST /api/ordenes/<id>/transicion
 * Body: { aEstado: Estado, nota?: string, imprimirComprobante?: boolean }
 *
 * `nota` queda en el historial con el cambio. Al marcar "Terminado"
 * (listo_entrega) es opcional: qué se hizo, si el técnico quiere dejarlo.
 *
 * La única puerta para cambiar el estado de una orden desde la app del
 * técnico o el admin. Arma el conjunto de requisitos cumplidos
 * consultando la orden real, y llama a la misma transicionar() de
 * lib/estados.ts que usa /api/aprobacion -- ninguna pantalla decide
 * por su cuenta si un salto es válido.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  RequisitoFaltanteError,
  TransicionInvalidaError,
  transicionar,
  type Estado,
  type Requisito,
} from "@/lib/estados";
import { obtenerCuentaOrden } from "@/lib/cuenta-orden";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";
import { liberarReservas } from "@/lib/reservas-servidor";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    aEstado?: Estado;
    imprimirComprobante?: boolean;
    nota?: string;
  };
  if (!body.aEstado) {
    return NextResponse.json({ error: "falta aEstado" }, { status: 400 });
  }
  const nota = typeof body.nota === "string" ? body.nota.trim().slice(0, 1000) : "";

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, tecnico_id")
    .eq("id", id)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const cumplidos = new Set<Requisito>();

  // Quien marca el equipo terminado o parado por repuesto sin que la
  // orden tenga técnico queda como su técnico: hizo el trabajo. De ahí
  // sale la productividad por técnico de los reportes. La entrega la
  // hace el mostrador y no cuenta.
  const tecnicoId = orden.tecnico_id ?? (body.aEstado === "entregada" ? null : user.id);

  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("id, total, estado, decision")
    .eq("orden_id", id)
    .order("enviada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cotizacion) cumplidos.add("tiene_cotizacion");
  if (cotizacion?.decision === "aprobada") cumplidos.add("cotizacion_aprobada");

  // El saldo sale de la misma cuenta que ven /abonos y /entregar
  // (lib/cuenta-orden.ts): lo usado o lo cotizado, lo mayor, menos los
  // abonos y cobros.
  const cuenta = await obtenerCuentaOrden(supabase, id);
  if (cuenta && cuenta.saldo === 0) cumplidos.add("saldo_en_cero");

  try {
    transicionar(orden.estado as Estado, body.aEstado, cumplidos);
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const { error: errUpdate } = await supabase
    .from("orden")
    .update({
      estado: body.aEstado,
      fase_id: null,
      tecnico_id: tecnicoId,
      cerrada_en: body.aEstado === "entregada" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: body.aEstado,
    autor_id: user.id,
    nota: nota || null,
  });

  // El PIN/patrón del equipo ya no hace falta una vez el cliente se lo
  // llevó -- no debe seguir acumulándose indefinidamente (Fase A2 del
  // Plan 3, supabase/migrations/0038_orden_acceso.sql).
  if (body.aEstado === "entregada") {
    await supabase.from("orden_acceso").delete().eq("orden_id", id);
    await liberarReservas(supabase, id);
    if (body.imprimirComprobante) {
      await imprimirComprobanteEntrega(supabase, id, orden.empresa_id, user.id);
    }
  }

  return NextResponse.json({ ok: true, estado: body.aEstado });
}

/**
 * Cuando la orden ya estaba pagada antes de entregarse (anticipo, o se
 * cobró en otro turno), la entrega no crea venta nueva -- el dinero ya
 * entró a las cuentas del día en que se pagó -- pero quien entrega igual
 * necesita el recibo para el cliente. Se reimprime con el número de la
 * última venta de la orden y lo que de verdad se usó (orden_item).
 */
async function imprimirComprobanteEntrega(
  supabase: Awaited<ReturnType<typeof clienteServidor>>,
  ordenId: string,
  empresaId: string,
  userId: string,
) {
  const sedeId = await obtenerSedeActivaId(supabase);
  if (!sedeId) return;

  const [{ data: items }, { data: ventas }, { data: perfil }, { data: orden }, cuenta] = await Promise.all([
    supabase.from("orden_item").select("descripcion, cantidad, precio_unit").eq("orden_id", ordenId),
    supabase
      .from("venta")
      .select("numero, total, pago ( medio )")
      .eq("orden_id", ordenId)
      .eq("anulada", false)
      .order("creada_en", { ascending: true }),
    supabase.from("perfil").select("nombre").eq("id", userId).maybeSingle(),
    supabase.from("orden").select("numero").eq("id", ordenId).maybeSingle(),
    obtenerCuentaOrden(supabase, ordenId),
  ]);
  if (!ventas?.length) return;
  const totalItems = (items ?? []).reduce((s, it) => s + it.cantidad * Number(it.precio_unit), 0);

  const medios = [
    ...new Set(ventas.flatMap((v) => ((v.pago ?? []) as { medio: string }[]).map((p) => p.medio))),
  ];

  await encolarImpresion(supabase, {
    empresaId,
    sedeId,
    tipo: "recibo_venta",
    creadoPor: userId,
    carga: {
      numeroVenta: ventas[ventas.length - 1]!.numero,
      items: (items ?? []).map((it) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnit: Number(it.precio_unit),
      })),
      total: cuenta?.valor ?? totalItems,
      medioPago: medios.length ? `${medios.join(" + ")} (pagado)` : "Pagado",
      // Valor, lo pagado (abonos + cobros) y el saldo con que se entrega.
      cuentaOrden:
        cuenta && orden
          ? { numeroOrden: orden.numero, valor: cuenta.valor, abonadoAntes: cuenta.pagado, saldo: cuenta.saldo }
          : null,
      abreCajon: false,
      cajero: perfil ? perfil.nombre : null,
      imprimir: true,
    },
  });
}
