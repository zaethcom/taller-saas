/**
 * Negocios con y sin taller (0072_negocio_sin_taller.sql). Una empresa
 * sin taller solo vende: le quedan el POS, el inventario, compras,
 * clientes, reportes y configuración. Se le esconden las pantallas de
 * servicio técnico, y quien entre por enlace directo a una de ellas va
 * a Vender.
 *
 * Lo define el superadmin (tipo de empresa y ficha de la empresa); la
 * empresa no lo puede cambiar (0069).
 */
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteServidor } from "./supabase/servidor";
import { obtenerPerfilActual } from "./perfil";

/** Pantallas que solo existen con taller (prefijos de dirección). */
export const PANTALLAS_DE_TALLER = [
  "/recibir",
  "/entregar",
  "/abonos",
  "/ordenes",
  "/orden",
  "/escanear",
  "/equipos",
  "/servicios",
  "/mano-obra",
] as const;

export function esPantallaDeTaller(ruta: string): boolean {
  return PANTALLAS_DE_TALLER.some((p) => ruta === p || ruta.startsWith(p + "/"));
}

/** A dónde va una empresa sin taller cuando pide una pantalla de taller. */
export const DESTINO_SIN_TALLER = "/vender";

/**
 * ¿La empresa usa el taller? Ante cualquier error (por ejemplo, la
 * migración 0072 todavía no corrida) responde que sí: así nadie pierde
 * pantallas por un fallo de lectura, que es como funcionaba antes.
 */
export async function empresaIncluyeTaller(supabase: SupabaseClient, empresaId: string): Promise<boolean> {
  const { data, error } = await supabase.from("empresa").select("incluye_taller").eq("id", empresaId).maybeSingle();
  if (error || !data) return true;
  return (data as { incluye_taller?: boolean | null }).incluye_taller !== false;
}

/**
 * Para los layouts de las pantallas de taller: si la empresa no tiene
 * taller, manda a Vender. Sin sesión no hace nada (el layout de la
 * puerta ya manda a /login).
 */
export async function exigirTaller(): Promise<void> {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return;
  if (!(await empresaIncluyeTaller(supabase, perfil.empresaId))) redirect(DESTINO_SIN_TALLER);
}
