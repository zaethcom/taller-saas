/**
 * La cuenta de una orden: cuánto vale, qué se ha pagado (abonos y
 * cobros) y cuánto falta. Una sola fuente para /recibir, /abonos,
 * /entregar, /api/ventas y la transición a "entregada", para que el
 * saldo que ve quien cobra sea el mismo que exige el servidor.
 *
 * El valor de la orden es lo mayor entre lo que de verdad se usó o se
 * acordó (orden.total, que suma orden_item -- incluye el "valor del
 * servicio" que se pone al recibir) y la cotización vigente (la última
 * enviada que el cliente no rechazó). Así el cliente puede abonar sobre
 * lo cotizado aunque el técnico todavía no haya registrado lo que usó.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendiente } from "./caja";

export interface PagoOrden {
  ventaId: string;
  numero: number;
  tipo: string;
  monto: number;
  medio: string | null;
  fecha: string;
}

export interface CuentaOrden {
  valor: number;
  pagado: number;
  saldo: number;
  pagos: PagoOrden[];
}

export function valorOrden(totalItems: number, totalCotizacion: number | null): number {
  return Math.max(totalItems, totalCotizacion ?? 0);
}

export function resumirCuenta(totalItems: number, totalCotizacion: number | null, pagos: PagoOrden[]): CuentaOrden {
  const valor = valorOrden(totalItems, totalCotizacion);
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  return { valor, pagado, saldo: saldoPendiente(valor, pagado), pagos };
}

export async function obtenerCuentaOrden(supabase: SupabaseClient, ordenId: string): Promise<CuentaOrden | null> {
  const [{ data: orden }, { data: cotizacion }, { data: ventas }] = await Promise.all([
    supabase.from("orden").select("total").eq("id", ordenId).maybeSingle(),
    supabase
      .from("cotizacion")
      .select("total, decision")
      .eq("orden_id", ordenId)
      .not("enviada_en", "is", null)
      .order("enviada_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("venta")
      .select("id, numero, tipo, total, creada_en, pago ( medio )")
      .eq("orden_id", ordenId)
      .eq("anulada", false)
      .order("creada_en", { ascending: true }),
  ]);
  if (!orden) return null;

  const totalCotizacion = cotizacion && cotizacion.decision !== "rechazada" ? Number(cotizacion.total) : null;
  const pagos: PagoOrden[] = (ventas ?? []).map((v) => ({
    ventaId: v.id,
    numero: v.numero,
    tipo: v.tipo,
    monto: Number(v.total),
    medio: ((v.pago ?? []) as { medio: string }[])[0]?.medio ?? null,
    fecha: v.creada_en,
  }));

  return resumirCuenta(Number(orden.total), totalCotizacion, pagos);
}
