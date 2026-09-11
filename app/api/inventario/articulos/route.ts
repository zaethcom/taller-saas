/**
 * POST /api/inventario/articulos
 * Body: { tipo, marca?, modelo?, numeroSerie?, costo?, precioVenta? }
 *
 * Da entrada a UNA unidad de mercancía y encola su etiqueta en el mismo
 * paso -- no hay una acción "imprimir" aparte que alguien pueda saltarse.
 * Llega el artículo, se registra, se imprime; el siguiente artículo
 * repite exactamente lo mismo (ver app/(admin)/recepcion-mercancia).
 *
 * GET /api/inventario/articulos -- lista los artículos de la empresa,
 * para la tabla de /inventario.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { encolarImpresion } from "@/lib/impresion";

interface CuerpoArticulo {
  tipo: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  costo?: number;
  precioVenta?: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CuerpoArticulo;

  if (!body.tipo?.trim()) {
    return NextResponse.json({ error: "falta el tipo de artículo" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id")
    .eq("id", user.id)
    .single();

  if (!perfil?.sede_id) {
    return NextResponse.json({ error: "el usuario no tiene sede asignada" }, { status: 400 });
  }

  const { data: articulo, error } = await supabase
    .from("articulo")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: perfil.sede_id,
      tipo: body.tipo.trim(),
      marca: body.marca?.trim() || null,
      modelo: body.modelo?.trim() || null,
      numero_serie: body.numeroSerie?.trim() || null,
      costo: body.costo ?? 0,
      precio_venta: body.precioVenta ?? 0,
      creado_por: user.id,
    })
    .select("id, numero, tipo, marca, modelo")
    .single();

  if (error || !articulo) {
    return NextResponse.json({ error: error?.message ?? "no se pudo registrar el artículo" }, { status: 500 });
  }

  const codigo = `ART-${String(articulo.numero).padStart(6, "0")}`;

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "etiqueta_articulo",
    creadoPor: user.id,
    carga: {
      codigo,
      tipo: articulo.tipo,
      marca: articulo.marca,
      modelo: articulo.modelo,
    },
  });

  return NextResponse.json({ ok: true, articulo: { id: articulo.id, numero: articulo.numero, codigo } });
}

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("articulo")
    .select("id, numero, tipo, marca, modelo, numero_serie, precio_venta, estado, sede:sede_id ( nombre ), creado_en")
    .order("creado_en", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
