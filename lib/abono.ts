/**
 * Abonos a una orden: plata que el cliente deja a cuenta del servicio
 * (al recibir el equipo, o después, p. ej. cuando vuelve a autorizar la
 * cotización). Cada abono es una venta tipo "anticipo" ligada a la
 * orden, con su pago -- entra al turno de caja como cualquier venta y
 * descuenta el saldo que se cobra al entregar (lib/cuenta-orden.ts).
 *
 * Se valida en dos pasos para que /api/ordenes pueda revisar el abono
 * ANTES de crear la orden: si no hay turno o el método no sirve, no se
 * crea nada a medias.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { encolarImpresion } from "@/lib/impresion";

export interface DatosAbono {
  monto: number;
  metodoPagoId: string;
  montoRecibido?: number;
}

export interface AbonoValidado {
  monto: number;
  metodoPagoId: string;
  montoRecibido: number | null;
  metodo: { nombre: string; es_efectivo: boolean };
  turnoId: string;
}

export type ResultadoValidacion = { ok: true; abono: AbonoValidado } | { ok: false; error: string; status: number };

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export async function validarAbono(
  supabase: SupabaseClient,
  sedeId: string,
  datos: DatosAbono,
  saldo: number,
): Promise<ResultadoValidacion> {
  const monto = Math.round(Number(datos.monto) || 0);
  if (monto <= 0) return { ok: false, error: "el abono debe ser mayor a cero", status: 400 };
  if (monto > saldo) {
    return { ok: false, error: `el abono supera el saldo de la orden (${fmt(saldo)})`, status: 409 };
  }
  if (!datos.metodoPagoId) return { ok: false, error: "falta el método de pago del abono", status: 400 };

  const [{ data: metodo }, { data: turno }] = await Promise.all([
    supabase
      .from("metodo_pago")
      .select("nombre, es_efectivo")
      .eq("id", datos.metodoPagoId)
      .eq("activo", true)
      .maybeSingle(),
    supabase
      .from("turno_caja")
      .select("id")
      .eq("sede_id", sedeId)
      .is("cerrado_en", null)
      .order("abierto_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!metodo) return { ok: false, error: "método de pago inválido", status: 400 };
  if (!turno) return { ok: false, error: "no hay un turno de caja abierto en esta sede", status: 409 };

  const montoRecibido = metodo.es_efectivo ? Number(datos.montoRecibido) || 0 : null;
  if (montoRecibido !== null && montoRecibido < monto) {
    return { ok: false, error: "el efectivo recibido no alcanza el abono", status: 400 };
  }

  return {
    ok: true,
    abono: { monto, metodoPagoId: datos.metodoPagoId, montoRecibido, metodo, turnoId: turno.id },
  };
}

export async function registrarAbono(
  supabase: SupabaseClient,
  p: {
    abono: AbonoValidado;
    empresaId: string;
    sedeId: string;
    userId: string;
    ordenId: string;
    numeroOrden: number;
    /** Cuenta de la orden ANTES de este abono, para imprimir el saldo que queda. */
    valorOrden: number;
    pagadoAntes: number;
    cajero: string | null;
    /** false: solo abre el cajón si es efectivo, sin ticket (al recibir, el abono ya sale en el comprobante). */
    imprimir: boolean;
  },
): Promise<{ ok: true; ventaId: string; numero: number } | { ok: false; error: string }> {
  const { abono } = p;
  const descripcion = `Abono orden #${p.numeroOrden}`;

  const { data: venta, error } = await supabase
    .from("venta")
    .insert({
      empresa_id: p.empresaId,
      sede_id: p.sedeId,
      turno_id: abono.turnoId,
      orden_id: p.ordenId,
      tipo: "anticipo",
      total: abono.monto,
      creada_por: p.userId,
    })
    .select("id, numero")
    .single();
  if (error || !venta) return { ok: false, error: error?.message ?? "no se pudo registrar el abono" };

  await supabase.from("venta_item").insert({
    venta_id: venta.id,
    descripcion,
    cantidad: 1,
    precio_unit: abono.monto,
  });
  await supabase.from("pago").insert({
    venta_id: venta.id,
    medio: abono.metodo.nombre,
    monto: abono.monto,
    es_efectivo: abono.metodo.es_efectivo,
    metodo_pago_id: abono.metodoPagoId,
  });

  await encolarImpresion(supabase, {
    empresaId: p.empresaId,
    sedeId: p.sedeId,
    tipo: "recibo_venta",
    creadoPor: p.userId,
    carga: {
      numeroVenta: venta.numero,
      items: [{ descripcion, cantidad: 1, precioUnit: abono.monto }],
      total: abono.monto,
      etiquetaTotal: "ABONO",
      medioPago: abono.metodo.nombre,
      abreCajon: abono.metodo.es_efectivo,
      cajero: p.cajero,
      montoRecibido: abono.montoRecibido,
      cambio: abono.montoRecibido != null ? abono.montoRecibido - abono.monto : null,
      cuentaOrden: {
        numeroOrden: p.numeroOrden,
        valor: p.valorOrden,
        abonadoAntes: p.pagadoAntes,
        estePago: abono.monto,
        saldo: Math.max(0, p.valorOrden - p.pagadoAntes - abono.monto),
      },
      imprimir: p.imprimir,
    },
  });

  return { ok: true, ventaId: venta.id, numero: venta.numero };
}
