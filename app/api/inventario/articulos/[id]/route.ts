/**
 * PATCH /api/inventario/articulos/[id]
 * Body: { imagenUrl?, tipo?, marca?, modelo?, numeroSerie?, costo?,
 *         precioVenta?, condicion?, categoriaId? }
 *
 * Igual que PATCH /api/repuestos/[id] pero para un artículo
 * individualizado: la foto se agrega después de la recepción (que sigue
 * siendo un formulario rápido sin campos de mouse, ver
 * app/(admin)/recepcion-mercancia) en vez de durante ella, y los datos
 * se corrigen desde /inventario si se cargaron mal. RLS
 * (articulo está bajo _aplica_rls_empresa) aísla por empresa.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";
import { cambiosArticulo, type CuerpoArticulo } from "@/lib/edicion-producto";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const validado = cambiosArticulo((await req.json()) as CuerpoArticulo);
  if ("error" in validado) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }

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

  const { error } = await supabase.from("articulo").update(validado.cambios).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
