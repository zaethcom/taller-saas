/**
 * Quien revisa el equipo (guarda el diagnóstico o envía la cotización)
 * queda como su técnico si la orden todavía no tiene uno: de ahí sale la
 * productividad por técnico de los reportes y a quién le llega el aviso
 * cuando Compras recibe un repuesto. No cambia el estado de la orden:
 * revisar es parte de "En proceso" (lib/estados.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esFinal, type Estado } from "@/lib/estados";

export async function asignarTecnico(
  supabase: SupabaseClient,
  ordenId: string,
  userId: string,
): Promise<{ estado: Estado } | { error: string }> {
  const { data: orden } = await supabase.from("orden").select("estado, tecnico_id").eq("id", ordenId).maybeSingle();
  if (!orden) return { error: "orden no encontrada" };

  const estado = orden.estado as Estado;
  if (esFinal(estado)) return { error: "La orden ya se entregó." };
  if (!orden.tecnico_id) {
    const { error } = await supabase.from("orden").update({ tecnico_id: userId }).eq("id", ordenId);
    if (error) return { error: error.message };
  }
  return { estado };
}
