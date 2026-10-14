/**
 * POST /api/ordenes
 * Body: {
 *   clienteId?: string, clienteNuevo?: {nombre, documento?, telefono?, correo?},
 *   productoId?: string, productoNuevo?: {serial?, tipo, marca?, modelo?},
 *     (serial vacío: se genera uno, ver lib/serial-equipo.ts)
 *   motivo: string, infoAdicional?: string, telefonoAlterno?: string,
 *   valorServicio?: number,
 *   abono?: {monto, metodoPagoId, montoRecibido?},
 *   repuestos?: {repuestoId?, descripcion, cantidad}[],
 * }
 *
 * `valorServicio` queda como un orden_item tipo servicio con el motivo
 * como descripción (el servicio que se va a realizar), así entra a
 * orden.total y a la cuenta de la orden. `abono` es plata que el cliente
 * deja a cuenta (lib/abono.ts): se valida antes de crear nada y sale en
 * el comprobante junto con el saldo.
 *
 * `repuestos` son los que quien recibe ya sabe que lleva el daño. Lo que
 * no alcanza en la sede entra solo a Compras, vinculado a la orden
 * (lib/repuestos-recepcion.ts); lo que sí hay queda anotado en el
 * historial para el técnico.
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
import { generarSerialEquipo } from "@/lib/serial-equipo";
import { codigoEntrada as calcularCodigoEntrada } from "@/lib/codigo-entrada";
import { ESTADO_INICIAL } from "@/lib/estados";
import { buscarPrimeraFase } from "@/lib/fases";
import { recalcularTotalOrden } from "@/lib/orden-total";
import { registrarAbono, validarAbono, type AbonoValidado, type DatosAbono } from "@/lib/abono";
import { clasificarRepuestos, normalizarRepuestos, notaRepuestosRecepcion } from "@/lib/repuestos-recepcion";
import { reservadoEnSede } from "@/lib/reservas-servidor";
import { disponible } from "@/lib/reservas";

interface ClienteNuevo {
  nombre: string;
  documento?: string;
  telefono?: string;
  correo?: string;
}

interface ProductoNuevo {
  serial?: string;
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
  /** Otro número para escribirle al cliente (0054_orden_telefono_alterno.sql). */
  telefonoAlterno?: string;
  acceso?: AccesoDispositivo;
  valorServicio?: number;
  abono?: DatosAbono;
  repuestos?: unknown;
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
    .select("empresa_id, sede_id, nombre, codigo")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);

  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const valorServicio = Math.max(0, Math.round(Number(body.valorServicio) || 0));
  // El abono se valida antes de crear cliente, equipo u orden: sin turno
  // abierto o con un monto mayor al valor, no se crea nada a medias.
  let abono: AbonoValidado | null = null;
  if (body.abono && Number(body.abono.monto) > 0) {
    if (valorServicio <= 0) {
      return NextResponse.json({ error: "para recibir un abono, pon el valor del servicio" }, { status: 400 });
    }
    const validacion = await validarAbono(supabase, sedeActivaId, body.abono, valorServicio);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: validacion.status });
    }
    abono = validacion.abono;
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
  let serialGenerado: string | undefined;
  if (!productoId && body.productoNuevo) {
    const serialEscrito = body.productoNuevo.serial?.trim();
    const insertarProducto = (serial: string) =>
      supabase
        .from("producto")
        .insert({ empresa_id: perfil.empresa_id, cliente_id: clienteId, ...body.productoNuevo, serial })
        .select("id")
        .single();

    let serial = serialEscrito || generarSerialEquipo();
    let { data: producto, error: errProducto } = await insertarProducto(serial);
    // Un serial generado que justo choca con otro (23505): se prueba con
    // otro. Uno escrito a mano que choca sí es un error para quien recibe.
    for (let intento = 0; !serialEscrito && errProducto?.code === "23505" && intento < 3; intento++) {
      serial = generarSerialEquipo();
      ({ data: producto, error: errProducto } = await insertarProducto(serial));
    }
    if (!serialEscrito && producto) serialGenerado = serial;
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

  // Si la empresa configuró fases para "recibida" (0050_fase_orden.sql),
  // la orden nace en la primera.
  const faseInicial = await buscarPrimeraFase(supabase, perfil.empresa_id, ESTADO_INICIAL);

  const { data: orden, error: errOrden } = await supabase
    .from("orden")
    .insert({
      empresa_id: perfil.empresa_id,
      sede_id: sedeActivaId,
      producto_id: productoId,
      motivo: body.motivo.trim(),
      info_adicional: body.infoAdicional?.trim() || null,
      telefono_alterno: body.telefonoAlterno?.trim() || null,
      fase_id: faseInicial?.id ?? null,
    })
    .select("id, numero, token_publico")
    .single();

  if (errOrden || !orden) {
    return NextResponse.json({ error: errOrden?.message ?? "no se pudo crear la orden" }, { status: 500 });
  }

  // Repuestos identificados al recibir: lo que no hay en la sede va
  // directo a la lista de Compras, con esta orden como referencia, y
  // el resumen queda en el evento de recepción (sin un evento aparte,
  // que el cliente vería como un segundo "Recibida" en su seguimiento).
  const repuestos = normalizarRepuestos(body.repuestos);
  let faltantesCompras: string[] = [];
  let faltantesFallidos = false;
  let notaRepuestos: string | null = null;
  if (repuestos.length > 0) {
    const ids = [...new Set(repuestos.flatMap((r) => (r.repuestoId ? [r.repuestoId] : [])))];
    const { data: existencias } = ids.length
      ? await supabase.from("existencia").select("repuesto_id, cantidad").eq("sede_id", sedeActivaId).in("repuesto_id", ids)
      : { data: [] as { repuesto_id: string; cantidad: number }[] };
    // Lo apartado para otras órdenes (0056) no cuenta como disponible.
    const reservado = await reservadoEnSede(supabase, sedeActivaId, ids);
    const clasificacion = clasificarRepuestos(
      repuestos,
      new Map(
        (existencias ?? []).map((e) => [e.repuesto_id, disponible(Number(e.cantidad), reservado.get(e.repuesto_id) ?? 0)]),
      ),
    );

    if (clasificacion.faltantes.length > 0) {
      const { error: errFaltantes } = await supabase.from("repuesto_solicitud").insert(
        clasificacion.faltantes.map((f) => ({
          empresa_id: perfil.empresa_id,
          orden_id: orden.id,
          descripcion: f.descripcion,
          cantidad: f.cantidad,
          solicitado_por: user.id,
        })),
      );
      if (errFaltantes) faltantesFallidos = true;
      else faltantesCompras = clasificacion.faltantes.map((f) => f.descripcion);
    }

    notaRepuestos = notaRepuestosRecepcion(clasificacion);
  }

  await supabase.from("orden_evento").insert({
    empresa_id: perfil.empresa_id,
    orden_id: orden.id,
    a_estado: "recibida",
    a_fase: faseInicial?.nombre ?? null,
    autor_id: user.id,
    nota: notaRepuestos ? `Recepción inicial. ${notaRepuestos}` : "Recepción inicial",
  });

  if (valorServicio > 0) {
    await supabase.from("orden_item").insert({
      empresa_id: perfil.empresa_id,
      orden_id: orden.id,
      tipo: "servicio",
      descripcion: body.motivo.trim(),
      cantidad: 1,
      precio_unit: valorServicio,
      subtotal: valorServicio,
      creado_por: user.id,
    });
    await recalcularTotalOrden(supabase, orden.id);
  }

  // El abono no imprime su propio ticket (solo abre el cajón si es
  // efectivo): ya sale en el comprobante de recepción.
  let abonoRegistrado = false;
  if (abono) {
    const r = await registrarAbono(supabase, {
      abono,
      empresaId: perfil.empresa_id,
      sedeId: sedeActivaId,
      userId: user.id,
      ordenId: orden.id,
      numeroOrden: orden.numero,
      valorOrden: valorServicio,
      pagadoAntes: 0,
      cajero: perfil.codigo ? `${perfil.codigo} · ${perfil.nombre}` : perfil.nombre,
      imprimir: false,
    });
    abonoRegistrado = r.ok;
  }

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
  const codigoEntrada = calcularCodigoEntrada(config?.prefijo_etiqueta, orden.numero);
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
      valorServicio: valorServicio || null,
      abono: abono && abonoRegistrado ? { monto: abono.monto, medio: abono.metodo.nombre } : null,
      saldo: valorServicio ? valorServicio - (abono && abonoRegistrado ? abono.monto : 0) : null,
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
    // plantilla de etiqueta más grande que lo pida (0046).
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

  return NextResponse.json({
    ok: true,
    ordenId: orden.id,
    numero: orden.numero,
    tokenPublico: orden.token_publico,
    serialGenerado,
    abonoFallido: Boolean(abono && !abonoRegistrado),
    faltantesCompras,
    faltantesFallidos,
  });
}
