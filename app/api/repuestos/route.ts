/**
 * GET /api/repuestos?buscar=<texto>&categoriaId=<uuid>
 * Busca en el catálogo por código o descripción, con la existencia en
 * la sede del usuario -- lo que el técnico consulta antes de consumir
 * un repuesto o de decidir que hace falta marcarlo como faltante. Con
 * categoriaId, además filtra por categoría -- las pestañas de /vender.
 *
 * Con venta=1 (lo que pide /vender) solo devuelve los repuestos en venta
 * que tienen existencia en la sede activa: el técnico sí necesita ver un
 * repuesto agotado para marcarlo como faltante, el mostrador no.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";

export async function GET(req: NextRequest) {
  const buscar = req.nextUrl.searchParams.get("buscar")?.trim() ?? "";
  const categoriaId = req.nextUrl.searchParams.get("categoriaId");
  const paraVenta = req.nextUrl.searchParams.get("venta") === "1";

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const sedeActivaId = await obtenerSedeActivaId(supabase);
  // Sin sede activa no hay existencia que vender.
  if (paraVenta && !sedeActivaId) {
    return NextResponse.json([]);
  }

  // Para la venta el join es !inner y filtrado por sede y cantidad: así el
  // límite de 15 se aplica sobre lo vendible, no sobre todo el catálogo.
  const armarConsulta = (filtrarEnVenta: boolean) => {
    let consulta = supabase
      .from("repuesto")
      .select(
        paraVenta
          ? "id, codigo, descripcion, precio_venta, imagen_url, existencia!inner ( cantidad, sede_id )"
          : "id, codigo, descripcion, precio_venta, imagen_url, existencia ( cantidad, sede_id )",
      )
      .limit(15);

    if (paraVenta) {
      consulta = consulta.eq("existencia.sede_id", sedeActivaId).gt("existencia.cantidad", 0);
      if (filtrarEnVenta) consulta = consulta.eq("en_venta", true);
    }
    if (categoriaId) {
      consulta = consulta.eq("categoria_id", categoriaId);
    }
    if (buscar) {
      consulta = consulta.or(`codigo.ilike.%${buscar}%,descripcion.ilike.%${buscar}%`);
    }
    return consulta;
  };

  let { data, error } = await armarConsulta(paraVenta);
  // 42703 / PGRST204 = columna inexistente: la migración 0044 (en_venta) todavía no
  // corre en esta base. Mientras tanto se filtra solo por existencia.
  if ((error?.code === "42703" || error?.code === "PGRST204") && paraVenta) {
    ({ data, error } = await armarConsulta(false));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resultado = (data ?? []).map((r) => ({
    id: r.id,
    codigo: r.codigo,
    descripcion: r.descripcion,
    precioVenta: Number(r.precio_venta),
    imagenUrl: r.imagen_url,
    existenciaAqui: r.existencia.find((e) => e.sede_id === sedeActivaId)?.cantidad ?? 0,
  }));

  return NextResponse.json(resultado);
}
