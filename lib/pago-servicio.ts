/**
 * Registrar un pago de N meses del servicio de una empresa (0052): deja
 * la fila en pago_servicio y corre empresa.servicio_fin. Solo lo llama
 * el superadmin, con clienteAdmin() -- pago_servicio no tiene policies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esFechaIso, hoyIso, inicioDelPago, sumarMeses } from "@/lib/servicio-empresa";

export interface DatosPago {
  meses: number;
  valor?: number | null;
  nota?: string | null;
  /** Día en que pagó; por defecto hoy. No cambia desde cuándo cuenta el pago. */
  fechaPago?: string | null;
}

export function validarPago(datos: Partial<DatosPago>): string | null {
  if (!Number.isInteger(datos.meses) || (datos.meses ?? 0) < 1 || (datos.meses ?? 0) > 60) {
    return "los meses pagados deben ser un número entero entre 1 y 60";
  }
  if (datos.valor != null && (typeof datos.valor !== "number" || !(datos.valor >= 0))) {
    return "el valor pagado no es válido";
  }
  if (datos.fechaPago != null && !esFechaIso(datos.fechaPago)) {
    return "la fecha de pago no es válida";
  }
  return null;
}

export async function registrarPago(
  admin: SupabaseClient,
  empresaId: string,
  datos: DatosPago,
  superadminId: string,
): Promise<{ desde: string; hasta: string }> {
  const { data: empresa, error } = await admin
    .from("empresa")
    .select("servicio_inicio, servicio_fin")
    .eq("id", empresaId)
    .single();
  if (error || !empresa) throw new Error(error?.message ?? "la empresa no existe");

  const desde = inicioDelPago(empresa.servicio_fin, hoyIso());
  const hasta = sumarMeses(desde, datos.meses);

  const { error: errPago } = await admin.from("pago_servicio").insert({
    empresa_id: empresaId,
    fecha_pago: datos.fechaPago || hoyIso(),
    meses: datos.meses,
    valor: datos.valor ?? null,
    nota: datos.nota?.trim() || null,
    desde,
    hasta,
    registrado_por: superadminId,
  });
  if (errPago) throw new Error(errPago.message);

  const { error: errEmpresa } = await admin
    .from("empresa")
    .update({ servicio_inicio: empresa.servicio_inicio ?? desde, servicio_fin: hasta })
    .eq("id", empresaId);
  if (errEmpresa) throw new Error(errEmpresa.message);

  return { desde, hasta };
}
