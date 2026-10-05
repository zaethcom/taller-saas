/**
 * Leer el perfil (rol, sede, empresa) del usuario autenticado. Un solo
 * lugar para esta consulta -- la usan el login (para saber a dónde
 * redirigir), los layouts de las tres puertas (para decidir si el rol
 * entra) y cualquier pantalla que necesite saber quién es el usuario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rol } from "./permisos";
import { resolverSedeActiva, sedesPermitidas, type SedePermitida } from "./sede-activa";

export interface PerfilActual {
  id: string;
  nombre: string;
  rol: Rol;
  empresaId: string;
  empresaNombre: string;
  /**
   * La sede en la que el usuario está trabajando en este dispositivo
   * (lib/sede-activa.ts), no su sede principal. null si tiene varias
   * permitidas y todavía no eligió -- los layouts lo mandan a
   * /elegir-sede.
   */
  sedeId: string | null;
  sedeNombre: string | null;
  /** Las sedes a las que puede entrar (0042_perfil_sede.sql). */
  sedesPermitidas: SedePermitida[];
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
    .select("id, nombre, rol, empresa_id, sede_id, activo, empresa:empresa_id ( nombre ), sede:sede_id ( id, nombre )")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.activo) return null;

  // El join de Supabase infiere `empresa` como arreglo aunque la
  // relación sea 1:1 -- mismo caso ya visto en otras rutas del proyecto.
  const empresa = data.empresa as unknown as { nombre: string } | undefined;
  const sedePrincipal = (data.sede as unknown as SedePermitida | null) ?? null;

  const rol = data.rol as Rol;
  const sedes = await sedesPermitidas(supabase, { id: data.id, rol, sedePrincipal });
  const sedeActiva = await resolverSedeActiva(sedes);

  return {
    id: data.id,
    nombre: data.nombre,
    rol,
    empresaId: data.empresa_id,
    empresaNombre: empresa?.nombre ?? "",
    sedeId: sedeActiva?.id ?? null,
    sedeNombre: sedeActiva?.nombre ?? null,
    sedesPermitidas: sedes,
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

/**
 * Solo la sede activa (ver PerfilActual.sedeId) -- para las rutas que
 * ya leen su propia fila de perfil y únicamente necesitan saber en qué
 * sede registrar la venta, el turno, la orden o el traslado.
 */
export async function obtenerSedeActivaId(supabase: SupabaseClient): Promise<string | null> {
  return (await obtenerPerfilActual(supabase))?.sedeId ?? null;
}
