/**
 * Verificar si el usuario autenticado es superadmin -- un lugar único,
 * igual que obtenerPerfilActual() lo es para el rol dentro de una
 * empresa. Usa el cliente normal (RLS), nunca clienteAdmin() para esto:
 * la política de superadmin.select solo deja ver la PROPIA fila, así
 * que preguntar "¿la puedo ver?" es preguntar "¿soy yo?" -- no hay que
 * confiar en nada que mande el navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SuperadminActual {
  id: string;
  nombre: string;
}

export async function obtenerSuperadminActual(supabase: SupabaseClient): Promise<SuperadminActual | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("superadmin")
    .select("id, nombre, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.activo) return null;

  return { id: data.id, nombre: data.nombre };
}
