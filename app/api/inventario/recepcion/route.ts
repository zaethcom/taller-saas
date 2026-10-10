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
import { siguienteCodigoRepuesto } from "@/lib/codigo-interno";

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
    if (!nuevo.descripcion?.trim()) {
      return NextResponse.json(
        { error: "falta repuestoId (existente) o la descripción (nuevo)" },
        { status: 400 },
      );
    }

    // Sin código del proveedor, el sistema le da uno interno (REP-000123)
    // para que la etiqueta salga con un código de barras escaneable. Si
    // otra recepción toma el mismo número a la vez, se reintenta.
    const codigoDado = nuevo.codigo?.trim();
    let repuesto: { id: string; codigo: string; descripcion: string } | null = null;
    for (let intento = 0; !repuesto && intento < 3; intento++) {
      let codigoNuevo = codigoDado;
      if (!codigoNuevo) {
        const { data: existentes } = await supabase
          .from("repuesto")
          .select("codigo")
          .eq("empresa_id", perfil.empresaId)
          .like("codigo", "REP-______");
        codigoNuevo = siguienteCodigoRepuesto((existentes ?? []).map((r) => r.codigo as string));
      }

      const { data, error: errRepuesto } = await supabase
        .from("repuesto")
        .insert({
          empresa_id: perfil.empresaId,
          codigo: codigoNuevo,
          descripcion: nuevo.descripcion.trim(),
          precio_venta: nuevo.precioVenta ?? 0,
          categoria_id: nuevo.categoriaId ?? null,
        })
        .select("id, codigo, descripcion")
        .single();

      if (errRepuesto) {
        if (errRepuesto.code === "23505" && !codigoDado) continue;
        if (errRepuesto.code === "23505") {
          return NextResponse.json({ error: `Ya existe un repuesto con el código "${codigoDado}"` }, { status: 409 });
        }
        return NextResponse.json({ error: errRepuesto.message }, { status: 500 });
      }
      repuesto = data;
    }
    if (!repuesto) {
      return NextResponse.json({ error: "no se pudo asignar un código interno; intenta de nuevo" }, { status: 409 });
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

  return NextResponse.json({ ok: true, repuestoId, codigo, cantidad: nuevaCantidad });
}
