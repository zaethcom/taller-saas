/**
 * POST /api/ventas/<id>/reimprimir
 * Vuelve a encolar el recibo de una venta ya hecha -- para cuando se
 * cobró con "Imprimir recibo" desmarcado y después de todo hace falta
 * el papel, o se perdió. Reconstruye la carga desde lo que ya quedó
 * guardado (venta_item, pago) -- snapshot, no referencias vivas al
 * catálogo, mismo principio que el resto de impresión.
 *
 * No vuelve a tocar inventario ni caja: esto solo reimprime, no repite
 * la venta.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id, nombre, codigo")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const [{ data: venta }, { data: items }, { data: pago }] = await Promise.all([
    supabase.from("venta").select("numero, total, empresa_id").eq("id", id).maybeSingle(),
    supabase.from("venta_item").select("descripcion, cantidad, precio_unit").eq("venta_id", id),
    supabase.from("pago").select("medio, monto, es_efectivo").eq("venta_id", id).maybeSingle(),
  ]);

  if (!venta || venta.empresa_id !== perfil.empresa_id) {
    return NextResponse.json({ error: "venta no encontrada" }, { status: 404 });
  }

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    tipo: "recibo_venta",
    creadoPor: user.id,
    carga: {
      numeroVenta: venta.numero,
      items: (items ?? []).map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnit: Number(i.precio_unit),
      })),
      total: Number(venta.total),
      medioPago: pago?.medio ?? "",
      abreCajon: false, // reimpresión: el cajón ya se abrió (o no) en el cobro original
      cajero: perfil.codigo ? `${perfil.codigo} · ${perfil.nombre}` : perfil.nombre,
      montoRecibido: null,
      cambio: null,
    },
  });

  return NextResponse.json({ ok: true });
}
