/**
 * GET /api/ordenes/buscar?numero=<n>  |  ?token=<token_publico>
 * Lo que (pos)/entregar usa para encontrar la orden: estado, lo que de
 * verdad se usó (orden_item, Fase 5 del Plan 1) y el saldo pendiente ya
 * calculado con lib/caja.ts -- orden.total reemplaza a cotizacion.total
 * como base del saldo, porque es la realidad acumulada en orden_item,
 * no la propuesta original.
 *
 * `token` es lo que trae el QR de la etiqueta (ver /escanear): resuelve
 * igual que ?numero=, solo cambia cómo se busca la orden. `numero` acepta
 * también el código de entrada de la etiqueta ("OR000014", ver
 * lib/codigo-entrada.ts), que es lo que lee el escáner.
 */
import { NextRequest, NextResponse } from "next/server";
import { saldoPendiente } from "@/lib/caja";
import { clienteServidor } from "@/lib/supabase/servidor";
import { numeroDesdeCodigoEntrada } from "@/lib/codigo-entrada";

export async function GET(req: NextRequest) {
  const numero = req.nextUrl.searchParams.get("numero");
  const token = req.nextUrl.searchParams.get("token");
  if (!numero && !token) {
    return NextResponse.json({ error: "falta el número de orden o el token" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  let numeroOrden: number | null = null;
  if (numero && !token) {
    const texto = numero.trim();
    if (/^\d+$/.test(texto)) {
      numeroOrden = Number(texto);
    } else {
      const { data: perfil } = await supabase.from("perfil").select("empresa_id").eq("id", user.id).single();
      const { data: config } = await supabase
        .from("empresa_config")
        .select("prefijo_etiqueta")
        .eq("empresa_id", perfil?.empresa_id ?? "")
        .maybeSingle();
      numeroOrden = numeroDesdeCodigoEntrada(config?.prefijo_etiqueta, texto);
    }
    if (!numeroOrden) {
      return NextResponse.json({ error: "no existe una orden con ese dato" }, { status: 404 });
    }
  }

  let consulta = supabase.from("orden").select(
    `
      id, numero, estado, total,
      producto:producto_id ( marca, modelo, tipo, serial,
        cliente:cliente_id ( nombre ) )
    `,
  );
  consulta = token ? consulta.eq("token_publico", token) : consulta.eq("numero", numeroOrden);

  const { data: orden, error } = await consulta.maybeSingle();

  if (error || !orden) {
    return NextResponse.json({ error: "no existe una orden con ese dato" }, { status: 404 });
  }

  const [{ data: items }, { data: ventas }] = await Promise.all([
    supabase
      .from("orden_item")
      .select("descripcion, cantidad, precio_unit, repuesto_id")
      .eq("orden_id", orden.id),
    supabase.from("venta").select("total").eq("orden_id", orden.id).eq("anulada", false),
  ]);

  const total = Number(orden.total);
  const totalPagado = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);

  return NextResponse.json({
    ...orden,
    total,
    saldoPendiente: saldoPendiente(total, totalPagado),
    items: (items ?? []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnit: Number(it.precio_unit),
      repuestoId: it.repuesto_id,
    })),
  });
}
