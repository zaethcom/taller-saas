/**
 * Leer el perfil (rol, sede, empresa) del usuario autenticado. Un solo
 * lugar para esta consulta -- la usan el login (para saber a dónde
 * redirigir), los layouts de las tres puertas (para decidir si el rol
 * entra) y cualquier pantalla que necesite saber quién es el usuario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "./permisos";

export interface PerfilActual {
  id: string;
  nombre: string;
  rol: Rol;
  empresaId: string;
  empresaNombre: string;
  sedeId: string | null;
}

export async function obtenerPerfilActual(supabase: SupabaseClient): Promise<PerfilActual | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Ni siquiera hace falta revisar aquí si la empresa está suspendida
  // (superadmin, 0020_superadmin.sql): empresa_actual() ya exige
  // empresa.activa, y la política RLS de esta misma tabla exige
  // empresa_id = empresa_actual() -- así que la fila de un usuario cuya
  // empresa fue suspendida deja de ser visible aquí, por RLS, sola.
  const { data, error } = await supabase
    .from("perfil")
    .select("id, nombre, rol, empresa_id, sede_id, activo, empresa:empresa_id ( nombre )")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.activo) return null;

  // El join de Supabase infiere `empresa` como arreglo aunque la
  // relación sea 1:1 -- mismo caso ya visto en otras rutas del proyecto.
  const empresa = data.empresa as unknown as { nombre: string } | undefined;

  return {
    id: data.id,
    nombre: data.nombre,
    rol: data.rol as Rol,
    empresaId: data.empresa_id,
    empresaNombre: empresa?.nombre ?? "",
    sedeId: data.sede_id,
  };
}

/** A dónde mandar a cada rol justo después de iniciar sesión. */
export const ATERRIZAJE_POR_ROL: Record<Rol, string> = {
  admin: "/ordenes",
  recepcion: "/vender",
  tecnico: "/escanear",
  compras: "/compras",
  cajero: "/vender",
};
