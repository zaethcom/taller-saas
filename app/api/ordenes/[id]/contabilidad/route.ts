/**
 * GET /api/ordenes/<id>/contabilidad
 *
 * Cuánto se gastó en la orden, cuánto se cobra y la utilidad. Solo el
 * administrador (puede(rol, "ver_utilidad_orden")): el técnico y la
 * recepción no ven costos. Lo gastado es lo que Compras pagó por lo que
 * pidió para la orden (repuesto_solicitud.costo_compra, 0062) más los
 * repuestos del inventario que se usaron, a su costo del catálogo.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { obtenerCuentaOrden } from "@/lib/cuenta-orden";
import { resumirContabilidad } from "@/lib/compras/recepcion-orden";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "ver_utilidad_orden")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const [cuenta, { data: compras, error: errCompras }, { data: items }] = await Promise.all([
    obtenerCuentaOrden(supabase, id),
    supabase
      .from("repuesto_solicitud")
      .select("descripcion, producto, cantidad, costo_compra, recibido_en")
      .eq("orden_id", id)
      .in("estado", ["recibido", "consumido"])
      .order("recibido_en", { ascending: true }),
    supabase
      .from("orden_item")
      .select("descripcion, cantidad, repuesto:repuesto_id ( costo )")
      .eq("orden_id", id)
      .eq("tipo", "repuesto")
      .not("repuesto_id", "is", null),
  ]);
  if (!cuenta) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }
  if (errCompras) {
    // Sin 0062 no hay costo de compra que mostrar.
    return NextResponse.json({ error: errCompras.message }, { status: 500 });
  }

  // Lo recibido antes de 0062 entró al inventario y, si se usó, ya está
  // en orden_item con su costo: no se cuenta dos veces.
  const listaCompras = (compras ?? [])
    .filter((c) => c.costo_compra != null)
    .map((c) => ({
      producto: (c.producto as string | null) ?? c.descripcion,
      cantidad: c.cantidad,
      costo: Number(c.costo_compra),
    }));
  const listaInventario = (items ?? []).map((i) => {
    const repuesto = (Array.isArray(i.repuesto) ? i.repuesto[0] : i.repuesto) as { costo: number | null } | null;
    return {
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      costoUnit: repuesto?.costo != null ? Number(repuesto.costo) : null,
    };
  });

  return NextResponse.json({
    ...resumirContabilidad({
      cobrado: cuenta.valor,
      pagado: cuenta.pagado,
      compras: listaCompras,
      inventario: listaInventario,
    }),
    compras: listaCompras,
    inventario: listaInventario,
  });
}
