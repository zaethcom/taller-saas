/**
 * GET /api/repuestos?buscar=<texto>&categoriaId=<uuid>
 * Busca en el catálogo por código o descripción, con la existencia en
 * la sede del usuario -- lo que el técnico consulta antes de consumir
 * un repuesto o de decidir que hace falta marcarlo como faltante. Con
 * categoriaId, además filtra por categoría -- las pestañas de /vender.
 *
 * Devuelve también `enOtrasSedes`: cuánto hay en las DEMÁS sedes. Sin eso,
 * un técnico sin existencia propia no puede distinguir "no lo tenemos" de
 * "está en el almacén del otro local" -- y esa diferencia es la que separa
 * pedir un traslado de mandar a comprar algo que la empresa ya tiene.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";

export async function GET(req: NextRequest) {
  const buscar = req.nextUrl.searchParams.get("buscar")?.trim() ?? "";
  const categoriaId = req.nextUrl.searchParams.get("categoriaId");

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const sedeActivaId = await obtenerSedeActivaId(supabase);

  // Los nombres de las demás sedes, para poder decir "3 en Local 1" en vez
  // de "3 en otra parte". RLS ya limita esto a la empresa del usuario.
  const { data: sedes } = await supabase.from("sede").select("id, nombre");
  const nombreDeSede = new Map((sedes ?? []).map((s) => [s.id, s.nombre]));

  let consulta = supabase
    .from("repuesto")
    .select("id, codigo, descripcion, precio_venta, imagen_url, existencia ( cantidad, sede_id )")
    .limit(15);

  if (categoriaId) {
    consulta = consulta.eq("categoria_id", categoriaId);
  }
  if (buscar) {
    consulta = consulta.or(`codigo.ilike.%${buscar}%,descripcion.ilike.%${buscar}%`);
  }

  const { data, error } = await consulta;
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
    // Sin esto el técnico no puede distinguir «no lo tenemos» de «está en
    // el almacén», que es la diferencia entre pedir un traslado y mandar
    // a comprar. Se mide contra la sede ACTIVA, igual que existenciaAqui.
    enOtrasSedes: r.existencia
      .filter((e) => e.sede_id !== sedeActivaId && e.cantidad > 0)
      .map((e) => ({
        sedeId: e.sede_id,
        nombre: nombreDeSede.get(e.sede_id) ?? "otra sede",
        cantidad: e.cantidad,
      })),
  }));

  return NextResponse.json(resultado);
}
