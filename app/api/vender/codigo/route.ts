/**
 * GET /api/vender/codigo?codigo=<lo escaneado>
 *
 * Busca un producto por su código exacto para /vender, sin la categoría
 * elegida en pantalla ni el límite de 15 de la búsqueda normal: lo que
 * se escanea con la cámara o con un lector USB tiene que encontrarse
 * siempre. Si existe pero no se puede vender aquí, dice por qué en vez
 * de devolver una lista vacía.
 *
 * Respuestas:
 *   { tipo: "repuesto", repuesto }  -- mismo formato que /api/repuestos
 *   { tipo: "articulo", articulo }  -- mismo formato que /api/inventario/articulos
 *   { tipo: null, motivo }          -- no_existe | sin_existencia | no_en_venta | no_disponible | otra_sede
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { codigoArticulo, normalizarCodigoEscaneado, numeroDeCodigoArticulo } from "@/lib/codigo-interno";

export async function GET(req: NextRequest) {
  const codigo = normalizarCodigoEscaneado(req.nextUrl.searchParams.get("codigo") ?? "");
  if (!codigo) {
    return NextResponse.json({ tipo: null, motivo: "no_existe" });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const numero = numeroDeCodigoArticulo(codigo);
  if (numero !== null) {
    const { data: a, error } = await supabase
      .from("articulo")
      .select("id, numero, tipo, marca, modelo, numero_serie, precio_venta, imagen_url, estado, sede_id")
      .eq("numero", numero)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!a) return NextResponse.json({ tipo: null, motivo: "no_existe" });
    if (a.estado !== "en_stock") return NextResponse.json({ tipo: null, motivo: "no_disponible" });
    if (a.sede_id !== sedeActivaId) return NextResponse.json({ tipo: null, motivo: "otra_sede" });
    return NextResponse.json({ tipo: "articulo", articulo: { ...a, codigo: codigoArticulo(a.numero) } });
  }

  // ilike sin comodines = igual sin importar mayúsculas; se escapan los
  // comodines por si el código trae % o _.
  const patron = codigo.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: filas, error } = await supabase
    .from("repuesto")
    .select("id, codigo, descripcion, precio_venta, imagen_url, en_venta, existencia ( cantidad, sede_id )")
    .ilike("codigo", patron)
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const r = filas?.[0];
  if (!r) return NextResponse.json({ tipo: null, motivo: "no_existe" });

  const existenciaAqui = r.existencia.find((e) => e.sede_id === sedeActivaId)?.cantidad ?? 0;
  if (r.en_venta === false) return NextResponse.json({ tipo: null, motivo: "no_en_venta" });
  if (existenciaAqui <= 0) return NextResponse.json({ tipo: null, motivo: "sin_existencia" });

  return NextResponse.json({
    tipo: "repuesto",
    repuesto: {
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      precioVenta: Number(r.precio_venta),
      imagenUrl: r.imagen_url,
      existenciaAqui,
    },
  });
}
