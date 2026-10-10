/**
 * POST /api/inventario/etiqueta
 * Body: { repuestoId, copias } | { articuloId, copias }
 *
 * Vuelve a imprimir (o imprime por primera vez) la etiqueta de código de
 * barras de un producto que ya está en el catálogo -- la que sale sola al
 * recibir mercancía, pero a pedido: se despegó, se dañó, o el producto
 * entró antes de que la sede tuviera etiquetadora. Usa la misma
 * plantilla activa de /configuracion que la recepción, y sale por la
 * etiquetadora de la sede en la que está trabajando quien la pide.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { encolarImpresion } from "@/lib/impresion";
import { codigoArticulo, copiasValidas } from "@/lib/codigo-interno";

interface Cuerpo {
  repuestoId?: string;
  articuloId?: string;
  copias?: number;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Cuerpo;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!perfil.sedeId) {
    return NextResponse.json({ error: "elige primero la sede en la que estás" }, { status: 400 });
  }
  const copias = copiasValidas(body.copias ?? 1);
  if (!copias) {
    return NextResponse.json({ error: "las copias deben ser un número entre 1 y 100" }, { status: 400 });
  }

  if (body.repuestoId) {
    const { data: repuesto } = await supabase
      .from("repuesto")
      .select("codigo, descripcion")
      .eq("id", body.repuestoId)
      .maybeSingle();
    if (!repuesto) {
      return NextResponse.json({ error: "el repuesto no existe" }, { status: 404 });
    }
    // Un solo trabajo con P<copias>, igual que en la recepción.
    await encolarImpresion(supabase, {
      empresaId: perfil.empresaId,
      sedeId: perfil.sedeId,
      tipo: "etiqueta_repuesto",
      creadoPor: perfil.id,
      carga: {
        nombreEmpresa: perfil.empresaNombre,
        codigo: repuesto.codigo,
        descripcion: repuesto.descripcion,
        cantidadCopias: copias,
      },
    });
    return NextResponse.json({ ok: true, codigo: repuesto.codigo, copias });
  }

  if (body.articuloId) {
    const { data: articulo } = await supabase
      .from("articulo")
      .select("numero, tipo, marca, modelo")
      .eq("id", body.articuloId)
      .maybeSingle();
    if (!articulo) {
      return NextResponse.json({ error: "el artículo no existe" }, { status: 404 });
    }
    // La etiqueta de artículo no trae número de copias en la carga (cada
    // unidad tiene la suya), así que una fila por copia, como al recibir.
    const codigo = codigoArticulo(articulo.numero);
    for (let i = 0; i < copias; i++) {
      await encolarImpresion(supabase, {
        empresaId: perfil.empresaId,
        sedeId: perfil.sedeId,
        tipo: "etiqueta_articulo",
        creadoPor: perfil.id,
        carga: { codigo, tipo: articulo.tipo, marca: articulo.marca, modelo: articulo.modelo },
      });
    }
    return NextResponse.json({ ok: true, codigo, copias });
  }

  return NextResponse.json({ error: "falta repuestoId o articuloId" }, { status: 400 });
}
