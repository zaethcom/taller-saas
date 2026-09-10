/**
 * POST /api/ordenes
 * Body: {
 *   clienteId?: string, clienteNuevo?: {nombre, documento?, telefono?, correo?},
 *   productoId?: string, productoNuevo?: {serial, tipo, marca?, modelo?},
 *   motivo: string,
 * }
 *
 * El punto de entrada de todo el sistema: recibir un equipo. Reutiliza
 * cliente y producto si ya existen (buscados antes con /api/clientes y
 * /api/productos), crea la orden en 'recibida', y encola comprobante +
 * etiqueta -- el requisito de 3 minutos de la Fase 3 del plano exige
 * que esto sea una sola llamada, no una serie de pantallas.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { encolarImpresion } from "@/lib/impresion";

interface ClienteNuevo {
  nombre: string;
  documento?: string;
  telefono?: string;
  correo?: string;
}

interface ProductoNuevo {
  serial: string;
  tipo: string;
  marca?: string;
  modelo?: string;
}

interface CuerpoOrden {
  clienteId?: string;
  clienteNuevo?: ClienteNuevo;
  productoId?: string;
  productoNuevo?: ProductoNuevo;
  motivo: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CuerpoOrden;

  if (!body.motivo?.trim()) {
    return NextResponse.json({ error: "falta el motivo" }, { status: 400 });
  }
  if (!body.clienteId && !body.clienteNuevo) {
    return NextResponse.json({ error: "falta el cliente" }, { status: 400 });
  }
  if (!body.productoId && !body.productoNuevo) {
    return NextResponse.json({ error: "falta el equipo" }, { status: 400 });
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

  let clienteId = body.clienteId;
  if (!clienteId && body.clienteNuevo) {
    const { data: cliente, error: errCliente } = await supabase
      .from("cliente")
      .insert({ empresa_id: perfil.empresa_id, ...body.clienteNuevo })
      .select("id")
      .single();
    if (errCliente || !cliente) {
      return NextResponse.json({ error: errCliente?.message ?? "no se pudo crear el cliente" }, { status: 500 });
    }
    clienteId = cliente.id;
  }

  let productoId = body.productoId;
  if (!productoId && body.productoNuevo) {
    const { data: producto, error: errProducto } = await supabase
      .from("producto")
      .insert({ empresa_id: perfil.empresa_id, cliente_id: clienteId, ...body.productoNuevo })
      .select("id")
      .single();
    if (errProducto || !producto) {
      // El error más probable: el serial ya existe en esta empresa
      // (unique (empresa_id, serial) en 0001_base.sql) -- el llamador
      // debería haber buscado con GET /api/productos antes de llegar
      // aquí, pero se responde con claridad si no lo hizo.
      return NextResponse.json(
        { error: errProducto?.message ?? "no se pudo registrar el equipo" },
        { status: 409 },
      );
    }
    productoId = producto.id;
  }

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: perfil.sede_id,
      producto_id: productoId,
      motivo: body.motivo.trim(),
    })
    .select("id, numero, token_publico")
    .single();

  if (errOrden || !orden) {
    return NextResponse.json({ error: errOrden?.message ?? "no se pudo crear la orden" }, { status: 500 });
  }

  await supabase.from("orden_evento").insert({
    empresa_id: perfil.empresa_id,
    orden_id: orden.id,
    a_estado: "recibida",
    autor_id: user.id,
    nota: "Recepción inicial",
  });

  const { data: producto } = await supabase
    .from("producto")
    .select("serial, tipo, marca, modelo, cliente:cliente_id ( nombre )")
    .eq("id", productoId)
    .single();

  const urlSeguimiento = `${process.env.NEXT_PUBLIC_APP_URL}/seguimiento/${orden.token_publico}`;

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "comprobante_recepcion",
    creadoPor: user.id,
    carga: {
      numeroOrden: orden.numero,
      // @ts-expect-error -- join inferido como array por el tipado genérico
      clienteNombre: producto?.cliente?.nombre ?? "",
      producto: [producto?.marca, producto?.modelo].filter(Boolean).join(" ") || producto?.tipo || "",
      motivo: body.motivo.trim(),
      fecha: new Date().toLocaleDateString("es-CO"),
      urlSeguimiento,
    },
  });

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: perfil.sede_id,
    tipo: "etiqueta_qr",
    creadoPor: user.id,
    ordenId: orden.id,
    carga: {
      serial: producto?.serial ?? "",
      tipo: producto?.tipo ?? "",
      marca: producto?.marca ?? null,
      modelo: producto?.modelo ?? null,
      numeroOrden: orden.numero,
      contenidoQr: urlSeguimiento,
    },
  });

  return NextResponse.json({ ok: true, ordenId: orden.id, numero: orden.numero });
}
