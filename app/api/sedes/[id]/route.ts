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
import { mensajeSedeConHistorial } from "@/lib/sede-historial";

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
      return NextResponse.json(
        { error: await mensajeSedeConHistorial(supabase, id) },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
