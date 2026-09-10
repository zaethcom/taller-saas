/**
 * Autenticación de las estaciones de impresión: no tienen sesión de
 * usuario, se identifican con una clave propia por sede (ver
 * supabase/migrations/0006_estaciones.sql).
 */
import { createHash } from "node:crypto";
import { clienteAdmin } from "./supabase/servidor";

export interface IdentidadEstacion {
  sedeId: string;
  empresaId: string;
}

function hashClave(clave: string): string {
  return createHash("sha256").update(clave).digest("hex");
}

/**
 * Extrae la clave del header Authorization: Bearer <clave> y la valida
 * contra estacion_credencial. Devuelve null si falta, está mal formada,
 * o no corresponde a ninguna estación activa -- el llamador responde 401.
 */
export async function verificarEstacion(
  authorizationHeader: string | null,
): Promise<IdentidadEstacion | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const clave = authorizationHeader.slice("Bearer ".length).trim();
  if (!clave) return null;

  const admin = clienteAdmin();
  const { data, error } = await admin
    .rpc("verificar_clave_estacion", { p_clave_hash: hashClave(clave) })
    .single<{ sede_id: string; empresa_id: string }>();

  if (error || !data) return null;

  return { sedeId: data.sede_id, empresaId: data.empresa_id };
}
