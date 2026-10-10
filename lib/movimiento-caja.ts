/**
 * Leer los movimientos de dinero de un turno (0054_movimiento_caja.sql)
 * -- lo usan /api/turno/actual para mostrarlos y /api/turno/cerrar para
 * cuadrar la caja. La suma vive en lib/caja.ts (totalesMovimientos).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoMovimientoCaja } from "./caja";

export interface MovimientoCajaFila {
  id: string;
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string;
  autor: string | null;
  creadoEn: string;
}

export async function movimientosDelTurno(supabase: SupabaseClient, turnoId: string): Promise<MovimientoCajaFila[]> {
  const { data, error } = await supabase
    .from("movimiento_caja")
    .select("id, tipo, monto, motivo, creado_en, autor:autor_id ( nombre )")
    .eq("turno_id", turnoId)
    .order("creado_en");
  // Si la migración 0054 aún no está aplicada, el turno funciona igual
  // que antes: sin movimientos, en vez de romper la pantalla de caja.
  if (error || !data) return [];

  return data.map((m) => {
    const autor = m.autor as { nombre: string | null } | { nombre: string | null }[] | null;
    return {
      id: m.id,
      tipo: m.tipo as TipoMovimientoCaja,
      monto: Number(m.monto),
      motivo: m.motivo,
      autor: (Array.isArray(autor) ? autor[0]?.nombre : autor?.nombre) ?? null,
      creadoEn: m.creado_en,
    };
  });
}
