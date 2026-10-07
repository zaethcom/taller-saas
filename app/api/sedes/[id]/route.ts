/**
 * DELETE /api/sedes/<id>
 * Eliminar una sede que sobra (creada por error, o reemplazada por
 * otra). Solo se borra si nunca se usó: órdenes, ventas, turnos,
 * inventario, traslados, trabajos de impresión y usuarios que la
 * tienen como sede principal apuntan a `sede` sin cascade, así que
 * Postgres responde 23503 y se devuelve un 409 que dice qué la está
 * usando. Lo que es solo configuración de la sede (impresoras, marca,
 * acceso de usuarios en perfil_sede) sí cae en cascada.
 *
 * Tampoco se deja eliminar la última sede de la empresa: sin ninguna
 * no se puede vender ni recibir equipos.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data: sedes, error: errorSedes } = await supabase.from("sede").select("id");
  if (errorSedes) {
    return NextResponse.json({ error: errorSedes.message }, { status: 500 });
  }
  if (!sedes.some((s) => s.id === id)) {
    return NextResponse.json({ error: "la sede no existe" }, { status: 404 });
  }
  if (sedes.length <= 1) {
    return NextResponse.json({ error: "No se puede eliminar la única sede de la empresa." }, { status: 409 });
  }

  const { error } = await supabase.from("sede").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      const conteos = await Promise.all(
        USOS.map(({ tabla, columna }) =>
          supabase.from(tabla).select("*", { count: "exact", head: true }).eq(columna, id),
        ),
      );
      const enUso = [...new Set(USOS.filter((_, i) => (conteos[i]?.count ?? 0) > 0).map((u) => u.nombre))];
      const detalle = enUso.length > 0 ? `: tiene ${enUso.join(", ")}` : "";
      return NextResponse.json(
        { error: `No se puede eliminar porque ya tiene historial${detalle}.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
