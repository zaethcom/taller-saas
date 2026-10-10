/**
 * Leer los ajustes de la etiquetadora de una sede (migración 0051). Va en
 * una consulta aparte de la del idioma a propósito: si la migración no
 * está aplicada todavía, esta falla sola y se imprime sin ajustes, en vez
 * de arrastrar al idioma y mandarle PPLB a una Zebra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizarAjustes,
  type AjustesEtiquetadora,
} from "@/estacion/ajustes-etiquetadora";

export async function leerAjustesEtiquetadora(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<AjustesEtiquetadora> {
  const { data, error } = await supabase
    .from("impresora_sede")
    .select("etiquetas_ajustes")
    .eq("sede_id", sedeId)
    .maybeSingle();
  if (error || !data) return {};
  return normalizarAjustes(data.etiquetas_ajustes);
}
