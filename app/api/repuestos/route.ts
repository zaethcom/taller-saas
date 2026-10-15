/**
 * GET /api/repuestos?buscar=<texto>&categoriaId=<uuid>
 * Busca en el catálogo por palabras (código, descripción, marca, modelo
 * o categoría; lib/busqueda-repuesto.ts), con la existencia en
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
import { reservadoEnSede } from "@/lib/reservas-servidor";
import { disponible } from "@/lib/reservas";
import { filtroPalabra, palabrasBusqueda } from "@/lib/busqueda-repuesto";

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

  // Categorías cuyo nombre contiene cada palabra buscada.
  const palabras = palabrasBusqueda(buscar);
  const categoriasPorPalabra = new Map<string, string[]>();
  if (palabras.length > 0) {
    const { data: categorias } = await supabase.from("categoria").select("id, nombre");
    for (const palabra of palabras) {
      const p = palabra.toLocaleLowerCase("es");
      categoriasPorPalabra.set(
        palabra,
        (categorias ?? []).filter((c) => String(c.nombre).toLocaleLowerCase("es").includes(p)).map((c) => c.id),
      );
    }
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
    for (const palabra of palabras) {
      consulta = consulta.or(filtroPalabra(palabra, categoriasPorPalabra.get(palabra)));
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

  // Lo apartado para órdenes aprobadas (0056) no se ofrece en el
  // mostrador; el técnico ve cuánto hay y cuánto ya tiene dueño.
  const reservado = sedeActivaId
    ? await reservadoEnSede(supabase, sedeActivaId, (data ?? []).map((r) => r.id))
    : new Map<string, number>();

  const resultado = (data ?? []).map((r) => {
    const existencia = r.existencia.find((e) => e.sede_id === sedeActivaId)?.cantidad ?? 0;
    const reservadoAqui = reservado.get(r.id) ?? 0;
    return {
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      precioVenta: Number(r.precio_venta),
      imagenUrl: r.imagen_url,
      existenciaAqui: paraVenta ? disponible(existencia, reservadoAqui) : existencia,
      reservadoAqui,
    };
  });

  return NextResponse.json(paraVenta ? resultado.filter((r) => r.existenciaAqui > 0) : resultado);
}
