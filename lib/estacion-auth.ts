/**
 * Autenticación de las estaciones de impresión: no tienen sesión de
 * usuario, se identifican con una clave propia por sede (ver
 * supabase/migrations/0006_estaciones.sql).
 */
import { createHash, randomBytes } from "node:crypto";
import { clienteAdmin } from "./supabase/servidor";

export interface IdentidadEstacion {
  sedeId: string;
  empresaId: string;
}

/**
 * Exportada para que quien CREA una credencial guarde exactamente el
 * mismo hash que compara quien la verifica. Dos implementaciones de esto
 * en dos archivos es una clave que se guarda bien y no valida nunca.
 */
export function hashClave(clave: string): string {
  return createHash("sha256").update(clave).digest("hex");
}

/**
 * Una clave nueva para una estación. 32 bytes de aleatoriedad
 * criptográfica en base64url: sin `+`, `/` ni `=`, así viaja entera por
 * una URL, un JSON y un `Authorization: Bearer` sin que nadie tenga que
 * escaparla.
 *
 * No está pensada para teclearse a mano -- se copia y se pega. El código
 * corto para escribir en la pantalla del puente es otra cosa, y va en el
 * paso siguiente del plan.
 */
export function generarClaveEstacion(): string {
  return randomBytes(32).toString("base64url");
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

/** Cada cuánto, como mucho, se anota que la estación sigue viva. */
export const INTERVALO_CONTACTO_MS = 30_000;

/**
 * Anota que la estación de esta sede acaba de consultar la cola, para que
 * /sedes pueda mostrar si está en línea. La estación pregunta cada dos
 * segundos; escribir en cada consulta sería ruido, así que solo se
 * actualiza si la última marca tiene más de INTERVALO_CONTACTO_MS.
 *
 * Nunca falla hacia afuera: si no se puede anotar (por ejemplo, la
 * migración 0047 todavía no está aplicada), la impresión sigue igual.
 */
export async function registrarContacto(sedeId: string, ahora = new Date()): Promise<void> {
  const limite = new Date(ahora.getTime() - INTERVALO_CONTACTO_MS).toISOString();
  try {
    await clienteAdmin()
      .from("estacion_credencial")
      .update({ ultimo_contacto_en: ahora.toISOString() })
      .eq("sede_id", sedeId)
      .is("revocada_en", null)
      .or(`ultimo_contacto_en.is.null,ultimo_contacto_en.lt.${limite}`);
  } catch {
    // Ver arriba: el latido es informativo, no puede tumbar la cola.
  }
}

