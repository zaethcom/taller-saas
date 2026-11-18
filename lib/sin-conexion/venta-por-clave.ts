/**
 * La venta ya creada con una clave local (migración 0070), para que lo
 * hecho sin internet no quede doble si el envío se repite. Lo usan
 * /api/ventas y /api/ordenes/[id]/abonos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esColumnaFaltante } from "./clave-local";

/** La venta con esa clave, null si no hay, "sin_columna" si falta la migración 0070. */
export async function ventaPorClave(
  supabase: SupabaseClient,
  empresaId: string,
  claveLocal: string,
): Promise<{ id: string; numero: number } | null | "sin_columna"> {
  const { data, error } = await supabase
    .from("venta")
    .select("id, numero")
    .eq("empresa_id", empresaId)
    .eq("clave_local", claveLocal)
    .maybeSingle();
  if (esColumnaFaltante(error)) return "sin_columna";
  return data ?? null;
}
