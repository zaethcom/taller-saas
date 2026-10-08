/**
 * En qué sede está trabajando el usuario en este dispositivo.
 *
 * Al iniciar sesión el usuario elige la sede (/elegir-sede), solo entre
 * las que tiene permitidas (0042_perfil_sede.sql). La elección vive en
 * una cookie del dispositivo, no en la base: el mismo usuario puede
 * tener sesión abierta en Local 1 y en la Novena a la vez sin que las
 * ventas de un lado caigan en la caja del otro.
 *
 * La cookie es solo una preferencia: cada lectura se valida contra las
 * sedes permitidas, así que escribirla a mano no da acceso a nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Rol } from "./permisos";

export const COOKIE_SEDE = "sede_activa";

export interface SedePermitida {
  id: string;
  nombre: string;
}

/**
 * Admin entra a cualquier sede de su empresa. El resto, a las de
 * perfil_sede más su sede principal (perfil.sede_id), que cuenta aunque
 * no tenga fila -- así nadie queda por fuera si la migración 0042 aún
 * no se ha aplicado o si alguien se creó sin fila en perfil_sede.
 */
export async function sedesPermitidas(
  supabase: SupabaseClient,
  perfil: { id: string; rol: Rol; sedePrincipal: SedePermitida | null },
): Promise<SedePermitida[]> {
  let sedes: SedePermitida[] = [];

  if (perfil.rol === "admin") {
    const { data } = await supabase.from("sede").select("id, nombre").order("nombre");
    sedes = data ?? [];
  } else {
    const { data } = await supabase.from("perfil_sede").select("sede:sede_id ( id, nombre )").eq("perfil_id", perfil.id);
    // El join de Supabase infiere `sede` como arreglo aunque la relación
    // sea N:1 -- mismo caso que en lib/perfil.ts.
    sedes = (data ?? [])
      .map((fila) => fila.sede as unknown as SedePermitida | null)
      .filter((s): s is SedePermitida => !!s);
  }

  if (perfil.sedePrincipal && !sedes.some((s) => s.id === perfil.sedePrincipal!.id)) {
    sedes.push(perfil.sedePrincipal);
  }

  return sedes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * La sede elegida en este dispositivo, si sigue siendo permitida. Con
 * una sola sede permitida no hay nada que elegir y se usa esa. Con
 * varias y sin elección válida devuelve null: los layouts mandan a
 * /elegir-sede antes de dejar trabajar.
 */
export async function resolverSedeActiva(sedes: SedePermitida[]): Promise<SedePermitida | null> {
  if (sedes.length === 1) return sedes[0] ?? null;

  let elegida: string | undefined;
  try {
    elegida = (await cookies()).get(COOKIE_SEDE)?.value;
  } catch {
    // Fuera de un request (no debería pasar): sin elección.
  }
  return sedes.find((s) => s.id === elegida) ?? null;
}

/** Opciones de la cookie: un año, para que el dispositivo recuerde su sede. */
export const OPCIONES_COOKIE_SEDE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};
