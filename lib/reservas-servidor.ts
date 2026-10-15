/**
 * Lecturas y escrituras de repuesto_reserva (0056). Si la migración
 * todavía no corrió en esta base, todo se comporta como si no hubiera
 * reservas: nada se aparta, pero nada falla.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { planearReserva, type LineaReserva } from "./reservas";

/** 42P01 / PGRST205: la tabla no existe todavía. */
function faltaTabla(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** repuestoId → cantidad apartada (activa) en la sede, opcionalmente sin contar una orden. */
export async function reservadoEnSede(
  supabase: SupabaseClient,
  sedeId: string,
  repuestoIds: string[],
  excluirOrdenId?: string,
): Promise<Map<string, number>> {
  const total = new Map<string, number>();
  if (repuestoIds.length === 0) return total;
  let consulta = supabase
    .from("repuesto_reserva")
    .select("repuesto_id, cantidad")
    .eq("sede_id", sedeId)
    .eq("estado", "activa")
    .in("repuesto_id", repuestoIds);
  if (excluirOrdenId) consulta = consulta.neq("orden_id", excluirOrdenId);
  const { data, error } = await consulta;
  if (error) return total;
  for (const r of data ?? []) total.set(r.repuesto_id, (total.get(r.repuesto_id) ?? 0) + r.cantidad);
  return total;
}

/**
 * Al aprobar: aparta lo cotizado que hay en la sede y pide a Compras lo
 * que falta (sin repetir una solicitud abierta de la misma orden).
 */
export async function reservarAlAprobar(
  admin: SupabaseClient,
  { ordenId, empresaId, sedeId, cotizacionId }: { ordenId: string; empresaId: string; sedeId: string; cotizacionId: string },
): Promise<{ reservados: LineaReserva[]; pedidos: LineaReserva[] }> {
  const { data: items } = await admin
    .from("cotizacion_item")
    .select("repuesto_id, descripcion, cantidad")
    .eq("cotizacion_id", cotizacionId)
    .not("repuesto_id", "is", null);
  const lineas: LineaReserva[] = (items ?? []).map((i) => ({
    repuestoId: i.repuesto_id as string,
    descripcion: i.descripcion,
    cantidad: i.cantidad,
  }));
  if (lineas.length === 0) return { reservados: [], pedidos: [] };

  const ids = [...new Set(lineas.map((l) => l.repuestoId))];
  const [{ data: existencias }, otras, { data: propias, error: errPropias }] = await Promise.all([
    admin.from("existencia").select("repuesto_id, cantidad").eq("sede_id", sedeId).in("repuesto_id", ids),
    reservadoEnSede(admin, sedeId, ids, ordenId),
    admin.from("repuesto_reserva").select("repuesto_id, cantidad").eq("orden_id", ordenId).eq("estado", "activa"),
  ]);
  const hayTabla = !faltaTabla(errPropias);
  const esta = new Map<string, number>();
  for (const r of propias ?? []) esta.set(r.repuesto_id, (esta.get(r.repuesto_id) ?? 0) + r.cantidad);

  const plan = planearReserva(
    lineas,
    new Map((existencias ?? []).map((e) => [e.repuesto_id, Number(e.cantidad)])),
    otras,
    esta,
  );

  let reservados: LineaReserva[] = [];
  if (hayTabla && plan.reservar.length > 0) {
    const { error } = await admin.from("repuesto_reserva").insert(
      plan.reservar.map((r) => ({
        empresa_id: empresaId,
        orden_id: ordenId,
        repuesto_id: r.repuestoId,
        sede_id: sedeId,
        cantidad: r.cantidad,
      })),
    );
    if (!error) reservados = plan.reservar;
  }

  // Lo que falta va a Compras, salvo que la orden ya lo tenga pedido.
  const { data: abiertas } = await admin
    .from("repuesto_solicitud")
    .select("descripcion")
    .eq("orden_id", ordenId)
    .in("estado", ["faltante", "solicitado"]);
  const yaPedido = new Set((abiertas ?? []).map((s) => s.descripcion.trim().toLowerCase()));
  const pedidos = plan.faltan.filter((f) => !yaPedido.has(f.descripcion.trim().toLowerCase()));
  if (pedidos.length > 0) {
    await admin.from("repuesto_solicitud").insert(
      pedidos.map((f) => ({ empresa_id: empresaId, orden_id: ordenId, descripcion: f.descripcion, cantidad: f.cantidad })),
    );
  }
  return { reservados, pedidos };
}

/** El técnico usó el repuesto: la reserva de esta orden se descuenta (o se cierra). */
export async function consumirReserva(supabase: SupabaseClient, ordenId: string, repuestoId: string, cantidad: number) {
  const { data } = await supabase
    .from("repuesto_reserva")
    .select("id, cantidad")
    .eq("orden_id", ordenId)
    .eq("repuesto_id", repuestoId)
    .eq("estado", "activa")
    .order("creada_en", { ascending: true });
  let resta = cantidad;
  for (const r of data ?? []) {
    if (resta <= 0) break;
    if (r.cantidad <= resta) {
      await supabase
        .from("repuesto_reserva")
        .update({ estado: "consumida", cerrada_en: new Date().toISOString() })
        .eq("id", r.id);
      resta -= r.cantidad;
    } else {
      await supabase.from("repuesto_reserva").update({ cantidad: r.cantidad - resta }).eq("id", r.id);
      resta = 0;
    }
  }
}

/** La orden se entregó: lo que quedó apartado sin usar vuelve a estar disponible. */
export async function liberarReservas(supabase: SupabaseClient, ordenId: string) {
  await supabase
    .from("repuesto_reserva")
    .update({ estado: "liberada", cerrada_en: new Date().toISOString() })
    .eq("orden_id", ordenId)
    .eq("estado", "activa");
}
