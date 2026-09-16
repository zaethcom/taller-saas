/**
 * POST /api/inventario/recepcion
 * Body: { repuestoId, sedeId, cantidad, motivo? }
 *     | { codigo, descripcion, precioVenta?, categoriaId?, sedeId, cantidad, motivo? }
 *
 * Recibe repuestos a granel de un proveedor -- lo que faltaba desde que
 * /recepcion-mercancia se limitó a artículos individualizados (ver su
 * comentario de cabecera). Si `repuestoId` ya existe en el catálogo,
 * solo suma cantidad; si en cambio llega `codigo`+`descripcion`, primero
 * da de alta el repuesto (cubre el caso de "producto nuevo" del punto 3
 * del documento de requerimientos) y recién entonces suma. En los dos
 * casos pasa por `mover_existencia` (0026_auditoria_inventario.sql), así
 * que la recepción queda auditada igual que cualquier otro movimiento.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { encolarImpresion } from "@/lib/impresion";

interface CuerpoComun {
  sedeId: string;
  cantidad: number;
  motivo?: string;
}

type Cuerpo =
  | (CuerpoComun & { repuestoId: string })
  | (CuerpoComun & { codigo: string; descripcion: string; precioVenta?: number; categoriaId?: string });

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Cuerpo>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.sedeId) {
    return NextResponse.json({ error: "falta la sede" }, { status: 400 });
  }
  if (!body.cantidad || body.cantidad <= 0) {
    return NextResponse.json({ error: "la cantidad debe ser mayor a cero" }, { status: 400 });
  }

  let repuestoId = "repuestoId" in body ? body.repuestoId : undefined;
  let codigo: string;
  let descripcion: string;

  if (!repuestoId) {
    const nuevo = body as Partial<Extract<Cuerpo, { codigo: string }>>;
    if (!nuevo.codigo?.trim() || !nuevo.descripcion?.trim()) {
      return NextResponse.json(
        { error: "falta repuestoId (existente) o código y descripción (nuevo)" },
        { status: 400 },
      );
    }

    const { data: repuesto, error: errRepuesto } = await supabase
      .from("repuesto")
      .insert({
        empresa_id: perfil.empresaId,
        codigo: nuevo.codigo.trim(),
        descripcion: nuevo.descripcion.trim(),
        precio_venta: nuevo.precioVenta ?? 0,
        categoria_id: nuevo.categoriaId ?? null,
      })
      .select("id, codigo, descripcion")
      .single();

    if (errRepuesto) {
      if (errRepuesto.code === "23505") {
        return NextResponse.json({ error: `Ya existe un repuesto con el código "${nuevo.codigo}"` }, { status: 409 });
      }
      return NextResponse.json({ error: errRepuesto.message }, { status: 500 });
    }
    repuestoId = repuesto.id;
    codigo = repuesto.codigo;
    descripcion = repuesto.descripcion;
  } else {
    const { data: repuesto, error: errRepuesto } = await supabase
      .from("repuesto")
      .select("codigo, descripcion")
      .eq("id", repuestoId)
      .single();
    if (errRepuesto || !repuesto) {
      return NextResponse.json({ error: "el repuesto no existe" }, { status: 404 });
    }
    codigo = repuesto.codigo;
    descripcion = repuesto.descripcion;
  }

  const { data: nuevaCantidad, error: errMovimiento } = await supabase.rpc("mover_existencia", {
    p_repuesto_id: repuestoId,
    p_sede_id: body.sedeId,
    p_delta: body.cantidad,
    p_tipo: "recepcion",
    p_motivo: body.motivo?.trim() || null,
  });

  if (errMovimiento) {
    return NextResponse.json({ error: errMovimiento.message }, { status: 500 });
  }

  // Una etiqueta de código de barras por unidad física recibida (punto 1
  // del documento de trazabilidad del taller) -- un solo trabajo con
  // P<cantidad> para que el puente la imprima tantas veces como
  // unidades entraron, en vez de una fila por unidad.
  await encolarImpresion(supabase, {
    empresaId: perfil.empresaId,
    sedeId: body.sedeId,
    tipo: "etiqueta_repuesto",
    creadoPor: perfil.id,
    carga: {
      nombreEmpresa: perfil.empresaNombre,
      codigo,
      descripcion,
      cantidadCopias: body.cantidad,
    },
  });

  return NextResponse.json({ ok: true, repuestoId, cantidad: nuevaCantidad });
}
