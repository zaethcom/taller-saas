/**
 * PATCH /api/servicios/<id> -- editar un servicio existente.
 * DELETE /api/servicios/<id> -- eliminarlo, salvo que ya esté en uso en
 * alguna cotización u orden (captura 23503, mismo patrón que
 * app/api/categorias/[id]/route.ts).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

interface CuerpoServicio {
  codigo?: string | null;
  nombre?: string;
  descripcion?: string | null;
  precio?: number;
  costoEstimado?: number | null;
  tiempoEstimadoMinutos?: number | null;
  activo?: boolean;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<CuerpoServicio>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (body.nombre !== undefined && !body.nombre.trim()) {
    return NextResponse.json({ error: "el nombre no puede quedar vacío" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("servicio")
    .update({
      ...(body.codigo !== undefined && { codigo: body.codigo?.trim() || null }),
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion?.trim() || null }),
      ...(body.precio !== undefined && { precio: body.precio }),
      ...(body.costoEstimado !== undefined && { costo_estimado: body.costoEstimado }),
      ...(body.tiempoEstimadoMinutos !== undefined && { tiempo_estimado_minutos: body.tiempoEstimadoMinutos }),
      ...(body.activo !== undefined && { activo: body.activo }),
    })
    .eq("id", id)
    .select("id, codigo, nombre, descripcion, precio, costo_estimado, tiempo_estimado_minutos, activo")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "el servicio no existe" }, { status: 404 });
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
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { error } = await supabase.from("servicio").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "No se puede eliminar: ya está en uso en una cotización o una orden." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
