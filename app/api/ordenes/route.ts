/**
 * POST /api/ordenes
 * Body: {
 *   clienteId?: string, clienteNuevo?: {nombre, documento?, telefono?, correo?},
 *   productoId?: string, productoNuevo?: {serial, tipo, marca?, modelo?},
 *   motivo: string, infoAdicional?: string,
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
import { obtenerSedeActivaId } from "@/lib/perfil";
import { encolarImpresion } from "@/lib/impresion";
import { notificarCliente } from "@/lib/mensajeria/notificar";

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

interface AccesoDispositivo {
  tipo: "pin3" | "pin4" | "pin6" | "patron" | "otro";
  valor: string;
  nota?: string;
}

interface CuerpoOrden {
  clienteId?: string;
  clienteNuevo?: ClienteNuevo;
  productoId?: string;
  productoNuevo?: ProductoNuevo;
  motivo: string;
  infoAdicional?: string;
  acceso?: AccesoDispositivo;
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
  const sedeActivaId = await obtenerSedeActivaId(supabase);

  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
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
      sede_id: sedeActivaId,
      producto_id: productoId,
      motivo: body.motivo.trim(),
      info_adicional: body.infoAdicional?.trim() || null,
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

  if (body.acceso?.valor?.trim()) {
    await supabase.from("orden_acceso").insert({
      empresa_id: perfil.empresa_id,
      orden_id: orden.id,
      tipo: body.acceso.tipo,
      valor: body.acceso.valor.trim(),
      nota: body.acceso.nota?.trim() || null,
      creado_por: user.id,
    });
  }

  const [{ data: producto }, { data: config }] = await Promise.all([
    supabase
      .from("producto")
      .select("serial, tipo, marca, modelo, cliente:cliente_id ( nombre, telefono, correo )")
      .eq("id", productoId)
      .single(),
    supabase
      .from("empresa_config")
      .select("prefijo_etiqueta")
      .eq("empresa_id", perfil.empresa_id)
      .maybeSingle(),
  ]);

  const urlSeguimiento = `${process.env.NEXT_PUBLIC_APP_URL}/seguimiento/${orden.token_publico}`;
  const nombreProducto = [producto?.marca, producto?.modelo].filter(Boolean).join(" ") || producto?.tipo || "";
  // El "código de entrada" que se ve en la etiqueta: el prefijo que la
  // empresa configuró (ej. "PS") + el número de orden, siempre
  // recalculable desde ahí -- nunca se guarda en `orden`.
  const codigoEntrada = `${config?.prefijo_etiqueta ?? "OR"}${String(orden.numero).padStart(6, "0")}`;
  // El join de Supabase infiere `cliente` como arreglo aunque la relación
  // sea 1:1.
  const cliente = producto?.cliente as unknown as
    | { nombre: string; telefono: string | null; correo: string | null }
    | undefined;

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    tipo: "comprobante_recepcion",
    creadoPor: user.id,
    carga: {
      numeroOrden: orden.numero,
      codigoEntrada,
      clienteNombre: cliente?.nombre ?? "",
      clienteTelefono: cliente?.telefono ?? null,
      producto: nombreProducto,
      serial: producto?.serial ?? "",
      motivo: body.motivo.trim(),
      fecha: new Date().toLocaleDateString("es-CO"),
      urlSeguimiento,
    },
  });

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    tipo: "etiqueta_qr",
    creadoPor: user.id,
    ordenId: orden.id,
    // La etiqueta física es de 30x25mm -- solo entra el QR (escaneable,
    // código de entrada) y el mismo código en texto grande como respaldo
    // si el QR no se puede leer. El resto de los datos (empresa, serial,
    // marca/modelo, número de orden) ya van en el comprobante impreso
    // arriba, que sí tiene espacio. `producto` solo lo imprime una
    // plantilla de etiqueta más grande que lo pida (0045).
    carga: { codigoEntrada, producto: nombreProducto },
  });

  const esCelular = /cel|tel[eé]fono|smartphone/i.test(producto?.tipo ?? "");
  await notificarCliente({
    clienteNombre: cliente?.nombre ?? "",
    clienteTelefono: cliente?.telefono,
    clienteCorreo: cliente?.correo,
    numeroOrden: orden.numero,
    producto: nombreProducto,
    urlSeguimiento,
    // Si el equipo recibido es el celular del cliente, puede no tener
    // su propio WhatsApp disponible para recibir el aviso -- ahí se usa
    // el número secundario dedicado a estos casos (ver lib/mensajeria/whatsapp.ts).
    usarWhatsappSecundario: esCelular,
  });

  return NextResponse.json({ ok: true, ordenId: orden.id, numero: orden.numero });
}
