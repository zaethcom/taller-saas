/**
 * POST /api/ordenes/<id>/transicion
 * Body: { aEstado: Estado }
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
import { saldoEnCero } from "@/lib/caja";
import { buscarPrimeraFase } from "@/lib/fases";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { aEstado?: Estado; imprimirComprobante?: boolean };
  if (!body.aEstado) {
    return NextResponse.json({ error: "falta aEstado" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .select("id, empresa_id, estado, tecnico_id, total, fase:fase_id ( nombre )")
    .eq("id", id)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const cumplidos = new Set<Requisito>();

  const [{ count: fotoEntrada }, { count: fotoSalida }, { count: firma }, { count: etiqueta }] =
    await Promise.all([
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "foto")
        .eq("fase", "entrada"),
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "foto")
        .eq("fase", "salida"),
      supabase
        .from("evidencia")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "firma"),
      supabase
        .from("trabajo_impresion")
        .select("id", { count: "exact", head: true })
        .eq("orden_id", id)
        .eq("tipo", "etiqueta_qr")
        .eq("estado", "impreso"),
    ]);

  if ((fotoEntrada ?? 0) > 0) cumplidos.add("tiene_foto_entrada");
  if ((fotoSalida ?? 0) > 0) cumplidos.add("tiene_foto_salida");
  if ((firma ?? 0) > 0) cumplidos.add("tiene_firma");
  if ((etiqueta ?? 0) > 0) cumplidos.add("tiene_etiqueta");

  // Nadie asignaba tecnico_id en ningún lugar del proyecto -- el
  // requisito tiene_tecnico de en_diagnostico no se podía cumplir nunca.
  // El punto natural para asignarlo es este: quien mueve la orden a
  // en_diagnostico se convierte en su técnico, autoasignado por hacer el
  // trabajo -- de ahí sale la productividad por técnico de la sección 5.
  const tecnicoId = orden.tecnico_id ?? (body.aEstado === "en_diagnostico" ? user.id : null);
  if (tecnicoId) cumplidos.add("tiene_tecnico");

  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("id, total, estado, decision")
    .eq("orden_id", id)
    .order("enviada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cotizacion) cumplidos.add("tiene_cotizacion");
  if (cotizacion?.decision === "aprobada") cumplidos.add("cotizacion_aprobada");

  // orden.total (Fase 5 del Plan 1, lo que de verdad se usó/hizo) es la
  // base del saldo, no cotizacion.total (la propuesta original) -- si
  // se agregó un repuesto después de aprobar, el saldo real lo refleja.
  const { data: ventas } = await supabase.from("venta").select("total").eq("orden_id", id).eq("anulada", false);
  const totalPagado = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
  if (saldoEnCero(Number(orden.total), totalPagado)) cumplidos.add("saldo_en_cero");

  try {
    transicionar(orden.estado as Estado, body.aEstado, cumplidos);
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  // Al entrar a un estado, la orden arranca en la primera fase activa
  // que la empresa configuró para él (0050_fase_orden.sql), o sin fase.
  // La fase nunca decide si la transición es válida -- eso ya se
  // resolvió arriba con transicionar().
  const faseNueva = await buscarPrimeraFase(supabase, orden.empresa_id, body.aEstado);
  // El join de Supabase infiere `fase` como arreglo aunque la relación
  // sea 1:1 -- mismo caso que lib/perfil.ts.
  const faseAnterior = orden.fase as unknown as { nombre: string } | null;

  const { error: errUpdate } = await supabase
    .from("orden")
    .update({
      estado: body.aEstado,
      fase_id: faseNueva?.id ?? null,
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
    de_fase: faseAnterior?.nombre ?? null,
    a_fase: faseNueva?.nombre ?? null,
    autor_id: user.id,
  });

  // El PIN/patrón del equipo ya no hace falta una vez el cliente se lo
  // llevó -- no debe seguir acumulándose indefinidamente (Fase A2 del
  // Plan 3, supabase/migrations/0038_orden_acceso.sql).
  if (body.aEstado === "entregada") {
    await supabase.from("orden_acceso").delete().eq("orden_id", id);
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

  const [{ data: items }, { data: ventas }, { data: perfil }] = await Promise.all([
    supabase.from("orden_item").select("descripcion, cantidad, precio_unit").eq("orden_id", ordenId),
    supabase
      .from("venta")
      .select("numero, total, pago ( medio )")
      .eq("orden_id", ordenId)
      .eq("anulada", false)
      .order("creada_en", { ascending: true }),
    supabase.from("perfil").select("nombre, codigo").eq("id", userId).maybeSingle(),
  ]);
  if (!ventas?.length) return;

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
      total: (items ?? []).reduce((s, it) => s + it.cantidad * Number(it.precio_unit), 0),
      medioPago: medios.length ? `${medios.join(" + ")} (pagado)` : "Pagado",
      abreCajon: false,
      cajero: perfil ? (perfil.codigo ? `${perfil.codigo} · ${perfil.nombre}` : perfil.nombre) : null,
      imprimir: true,
    },
  });
}
