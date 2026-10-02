/**
 * Si la orden ya tiene una cotización aprobada, cualquier orden_item
 * nuevo que se agregue de ahí en adelante (Fase F2 del Plan 3) queda
 * marcado para que el cliente también lo apruebe desde el enlace de
 * seguimiento -- siempre, sin umbral de monto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requiereNuevaAprobacion(supabase: SupabaseClient, ordenId: string): Promise<boolean> {
  const { data: cotizacion } = await supabase
    .from("cotizacion")
    .select("decision")
    .eq("orden_id", ordenId)
    .eq("decision", "aprobada")
    .limit(1)
    .maybeSingle();

  return !!cotizacion;
}
