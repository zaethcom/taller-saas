/**
 * orden.total se recalcula siempre desde orden_item, nunca se edita a
 * mano -- cada ruta que inserta un orden_item llama a esto después, en
 * la misma operación. Reemplaza a cotizacion.total como la fuente de
 * verdad de lo que se cobra (ver supabase/migrations/0036_orden_item.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function recalcularTotalOrden(supabase: SupabaseClient, ordenId: string): Promise<number> {
  const { data } = await supabase.from("orden_item").select("subtotal").eq("orden_id", ordenId);
  const total = (data ?? []).reduce((suma, fila) => suma + Number(fila.subtotal), 0);

  await supabase.from("orden").update({ total }).eq("id", ordenId);

  return total;
}
