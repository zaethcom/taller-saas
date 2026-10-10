/**
 * Qué ata una sede a su historial. Órdenes, ventas, turnos, inventario,
 * traslados, trabajos de impresión y usuarios que la tienen como sede
 * principal apuntan a `sede` sin cascade: borrar una sede así falla con
 * 23503. Esto sirve para decirle al usuario QUÉ la está usando. Lo usan
 * /api/sedes/[id] (admin de la empresa) y /api/superadmin/sedes/[id].
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tablas que atan una sede a su historial, con cómo se nombran al usuario. */
const USOS: { tabla: string; columna: string; nombre: string }[] = [
  { tabla: "orden", columna: "sede_id", nombre: "órdenes" },
  { tabla: "venta", columna: "sede_id", nombre: "ventas" },
  { tabla: "turno_caja", columna: "sede_id", nombre: "turnos de caja" },
  { tabla: "existencia", columna: "sede_id", nombre: "inventario" },
  { tabla: "movimiento_inventario", columna: "sede_id", nombre: "movimientos de inventario" },
  { tabla: "articulo", columna: "sede_id", nombre: "artículos" },
  { tabla: "traslado", columna: "sede_origen_id", nombre: "traslados" },
  { tabla: "traslado", columna: "sede_destino_id", nombre: "traslados" },
  { tabla: "perfil", columna: "sede_id", nombre: "usuarios con esta sede como principal" },
  { tabla: "trabajo_impresion", columna: "sede_id", nombre: "trabajos de impresión" },
  { tabla: "estacion_credencial", columna: "sede_id", nombre: "estaciones de impresión" },
  { tabla: "apertura_cajon", columna: "sede_id", nombre: "aperturas del cajón" },
];

/** El mensaje del 409 cuando el delete de una sede choca con 23503. */
export async function mensajeSedeConHistorial(supabase: SupabaseClient, sedeId: string): Promise<string> {
  const conteos = await Promise.all(
    USOS.map(({ tabla, columna }) =>
      supabase.from(tabla).select("*", { count: "exact", head: true }).eq(columna, sedeId),
    ),
  );
  const enUso = [...new Set(USOS.filter((_, i) => (conteos[i]?.count ?? 0) > 0).map((u) => u.nombre))];
  const detalle = enUso.length > 0 ? `: tiene ${enUso.join(", ")}` : "";
  return `No se puede eliminar porque ya tiene historial${detalle}.`;
}
