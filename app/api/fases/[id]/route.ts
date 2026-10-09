/**
 * PATCH /api/fases/<id> -- Body: { nombre?, posicion?, activo? }
 * Renombrar, mover o activar/desactivar una fase. Desactivarla es la
 * forma normal de quitarla: las órdenes que ya la tienen la conservan,
 * pero deja de ofrecerse.
 *
 * DELETE /api/fases/<id>
 * Eliminarla de verdad -- solo si ninguna orden la tiene puesta ahora.
 * orden.fase_id es `on delete set null`, así que Postgres no frenaría
 * el borrado con un 23503: la cuenta se hace aquí antes, y se responde
 * 409 con el mismo tipo de mensaje que app/api/categorias/[id]/route.ts.
 * El historial no se pierde: orden_evento guarda el nombre, no el id.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { nombre?: string; posicion?: number; activo?: boolean };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "configurar_fases")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (body.nombre !== undefined && !body.nombre.trim()) {
    return NextResponse.json({ error: "el nombre no puede quedar vacío" }, { status: 400 });
  }
  if (body.posicion !== undefined && !Number.isInteger(body.posicion)) {
    return NextResponse.json({ error: "posición inválida" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fase_orden")
    .update({
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.posicion !== undefined && { posicion: body.posicion }),
      ...(body.activo !== undefined && { activo: body.activo }),
    })
    .eq("id", id)
    .select("id, estado, nombre, posicion, activo")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "la fase no existe" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "configurar_fases")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { count: enUso } = await supabase
    .from("orden")
    .select("id", { count: "exact", head: true })
    .eq("fase_id", id);
  if ((enUso ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `No se puede eliminar: ${enUso} orden${enUso === 1 ? " está" : "es están"} en esta fase. Desactívela en su lugar.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("fase_orden").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "No se puede eliminar: está en uso. Desactívela en su lugar." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
