/**
 * PATCH /api/metodos-pago/<id>
 * Body: { activo?: boolean, nombre?: string, esEfectivo?: boolean }
 * Activar/desactivar, y ahora también renombrar o cambiar si cuenta
 * como efectivo -- nunca se borra uno que ya tenga pagos asociados,
 * porque pago.medio es un snapshot del nombre, no una referencia que
 * se rompería: por eso esto sigue siendo update, nunca delete.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { activo?: boolean; nombre?: string; esEfectivo?: boolean };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (body.activo === undefined && body.nombre === undefined && body.esEfectivo === undefined) {
    return NextResponse.json({ error: "no hay nada que actualizar" }, { status: 400 });
  }
  if (body.nombre !== undefined && !body.nombre.trim()) {
    return NextResponse.json({ error: "el nombre no puede quedar vacío" }, { status: 400 });
  }

  const { error } = await supabase
    .from("metodo_pago")
    .update({
      ...(body.activo !== undefined && { activo: body.activo }),
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.esEfectivo !== undefined && { es_efectivo: body.esEfectivo }),
    })
    .eq("id", id);
  if (error) {
    const mensaje = error.code === "23505" ? "ya existe un método con ese nombre" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true });
}
