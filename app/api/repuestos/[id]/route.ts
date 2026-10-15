/**
 * PATCH /api/repuestos/[id]
 * Body: { imagenUrl?, enVenta?, codigo?, descripcion?, precioVenta?,
 *         costo?, marca?, modelo?, categoriaId?, observacion? }
 *
 * Edita un repuesto del catálogo desde /inventario: su foto, si está en
 * venta (0044) y sus datos (código, descripción, precios, marca,
 * modelo, categoría). La validación vive en lib/edicion-producto.ts.
 * Las existencias no se tocan aquí: van por /api/inventario/ajuste, que
 * exige motivo. RLS (repuesto está bajo _aplica_rls_empresa) es lo que
 * impide editar un repuesto de otra empresa; este código no necesita
 * repetir esa comprobación.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";
import { cambiosRepuesto, type CuerpoRepuesto } from "@/lib/edicion-producto";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validado = cambiosRepuesto((await req.json()) as CuerpoRepuesto);
  if ("error" in validado) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }
  const { cambios } = validado;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no tienes permiso para editar el inventario" }, { status: 403 });
  }

  const { error } = await supabase.from("repuesto").update(cambios).eq("id", id);
  if (error?.code === "42703" || error?.code === "PGRST204") {
    return NextResponse.json(
      { error: "falta aplicar la migración 0044 (en venta) en la base de datos" },
      { status: 503 },
    );
  }
  if (error?.code === "23505") {
    return NextResponse.json({ error: `Ya existe otro repuesto con el código "${cambios.codigo}"` }, { status: 409 });
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
