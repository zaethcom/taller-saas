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
 *   claveLocal?: uuid, numero?: number, hechaEn?: string,
 * }
 *
 * claveLocal/numero/hechaEn: recepción hecha sin internet que se sube
 * después (plan sin internet, fase 4; migración 0071). claveLocal es el
 * id de la orden (si ya llegó, se devuelve la misma sin crear nada),
 * numero el que el equipo tomó de su bloque apartado y hechaEn cuándo se
 * recibió de verdad. Al subirla no se imprime el comprobante (el cliente
 * ya se fue) ni se abre el cajón por el abono; la etiqueta del equipo sí
 * se imprime. Si algo no cuadra (el número ya no sirve, el abono no
 * entra porque no hay turno), la orden se crea igual y se responde con
 * `avisos`.
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
 * /api/productos), crea la orden en proceso (o en falta de repuesto si se pidió algo a Compras), y encola comprobante +
 * etiqueta -- el requisito de 3 minutos de la Fase 3 del plano exige
 * que esto sea una sola llamada, no una serie de pantallas.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { fechaHoraRecibo } from "@/lib/fecha-recibo";
import { encolarImpresion } from "@/lib/impresion";
import { notificarCliente } from "@/lib/mensajeria/notificar";
import { generarSerialEquipo } from "@/lib/serial-equipo";
import { codigoEntrada as calcularCodigoEntrada } from "@/lib/codigo-entrada";
import { ESTADO_INICIAL, estadoSegunRepuestos } from "@/lib/estados";
import { recalcularTotalOrden } from "@/lib/orden-total";
import { registrarAbono, validarAbono, type AbonoValidado, type DatosAbono } from "@/lib/abono";
import { clasificarRepuestos, normalizarRepuestos, notaRepuestosRecepcion } from "@/lib/repuestos-recepcion";
import { reservadoEnSede } from "@/lib/reservas-servidor";
import { disponible } from "@/lib/reservas";
import { claveLocalValida, esSubidaSinConexion, horaSinConexion } from "@/lib/sin-conexion/clave-local";

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
  tipo: "pin" | "patron" | "contrasena" | "otro";
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
  claveLocal?: string;
  numero?: number;
  hechaEn?: string;
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
    .select("empresa_id, sede_id, nombre")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);

  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  // Sin internet el equipo le pone a la orden su propio id (claveLocal):
  // si el envío se repite, se devuelve la orden que ya llegó.
  const idLocal = claveLocalValida(body.claveLocal) ? body.claveLocal : null;
  const subida = esSubidaSinConexion(body);
  if (idLocal) {
    const { data: previa } = await supabase
      .from("orden")
      .select("id, numero, token_publico")
      .eq("id", idLocal)
      .maybeSingle();
    if (previa) {
      return NextResponse.json({
        ok: true,
        ordenId: previa.id,
        numero: previa.numero,
        tokenPublico: previa.token_publico,
        repetida: true,
      });
    }
  }
  const avisos: string[] = [];
  const numeroPedido = Number.isInteger(body.numero) && Number(body.numero) > 0 ? Number(body.numero) : null;

  const valorServicio = Math.max(0, Math.round(Number(body.valorServicio) || 0));
  // El abono se valida antes de crear cliente, equipo u orden: sin turno
  // abierto o con un monto mayor al valor, no se crea nada a medias.
  let abono: AbonoValidado | null = null;
  if (body.abono && Number(body.abono.monto) > 0) {
    if (valorServicio <= 0) {
      return NextResponse.json({ error: "para recibir un abono, pon el valor del servicio" }, { status: 400 });
    }
    const validacion = await validarAbono(supabase, sedeActivaId, body.abono, valorServicio);
    if (validacion.ok) {
      abono = validacion.abono;
    } else if (subida) {
      // El equipo ya está en el taller: la orden se crea igual.
      avisos.push(`El abono de la recepción no se registró: ${validacion.error}. Regístralo desde Cobrar y entregar.`);
    } else {
      return NextResponse.json({ error: validacion.error }, { status: validacion.status });
    }
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
    // Sin internet no se pudo buscar el serial: si el equipo ya estaba
    // registrado, se usa ese.
    if (subida && serialEscrito && errProducto?.code === "23505") {
      const { data: existente } = await supabase
        .from("producto")
        .select("id")
        .eq("empresa_id", perfil.empresa_id)
        .eq("serial", serialEscrito)
        .maybeSingle();
      if (existente) ({ data: producto, error: errProducto } = { data: existente, error: null });
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

  const filaOrden = {
    empresa_id: perfil.empresa_id,
    sede_id: sedeActivaId,
    producto_id: productoId,
    motivo: body.motivo.trim(),
    info_adicional: body.infoAdicional?.trim() || null,
    telefono_alterno: body.telefonoAlterno?.trim() || null,
    estado: ESTADO_INICIAL,
    ...(idLocal && { id: idLocal }),
    ...(subida && numeroPedido && { numero: numeroPedido }),
    ...(subida && horaSinConexion(body.hechaEn) && { abierta_en: horaSinConexion(body.hechaEn) }),
  };
  let { data: orden, error: errOrden } = await supabase
    .from("orden")
    .insert(filaOrden)
    .select("id, numero, token_publico")
    .single();
  if (errOrden?.code === "23505") {
    // ¿Llegó la misma orden por otro envío al mismo tiempo?
    const { data: previa } = idLocal
      ? await supabase.from("orden").select("id, numero, token_publico").eq("id", idLocal).maybeSingle()
      : { data: null };
    if (previa) {
      return NextResponse.json({
        ok: true,
        ordenId: previa.id,
        numero: previa.numero,
        tokenPublico: previa.token_publico,
        repetida: true,
      });
    }
    if ("numero" in filaOrden) {
      // El número ya lo tiene otra orden: se crea con el siguiente libre.
      const { numero: _n, ...sinNumero } = filaOrden;
      void _n;
      ({ data: orden, error: errOrden } = await supabase
        .from("orden")
        .insert(sinNumero)
        .select("id, numero, token_publico")
        .single());
    }
  }
  if (orden && subida && numeroPedido && orden.numero !== numeroPedido) {
    avisos.push(
      `La orden se recibió sin conexión como #${numeroPedido}, pero quedó registrada como #${orden.numero}: corrige el número escrito en el equipo.`,
    );
  }

  if (errOrden || !orden) {
    return NextResponse.json({ error: errOrden?.message ?? "no se pudo crear la orden" }, { status: 500 });
  }

  // Repuestos identificados al recibir: lo que no hay en la sede va
  // directo a la lista de Compras, con esta orden como referencia, y
  // el resumen queda en el evento de recepción (sin un evento aparte,
  // que el cliente vería como un segundo paso en su seguimiento).
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

  // Lo que se pidió a Compras al recibir deja el equipo parado desde el
  // principio: nace en "Falta repuesto" y vuelve solo a "En proceso"
  // cuando Compras lo recibe (lib/estados.ts).
  const estadoInicial = estadoSegunRepuestos(faltantesCompras.length);
  if (estadoInicial !== ESTADO_INICIAL) {
    await supabase.from("orden").update({ estado: estadoInicial }).eq("id", orden.id);
  }

  await supabase.from("orden_evento").insert({
    empresa_id: perfil.empresa_id,
    orden_id: orden.id,
    a_estado: estadoInicial,
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
      cajero: perfil.nombre,
      imprimir: false,
      claveLocal: idLocal,
      hechaEn: body.hechaEn,
      subidaSinConexion: subida,
    });
    abonoRegistrado = r.ok;
    if (!r.ok && subida) avisos.push(`El abono de la recepción no se registró: ${r.error}.`);
  }

  if (body.acceso?.valor?.trim()) {
    const fila = {
      empresa_id: perfil.empresa_id,
      orden_id: orden.id,
      tipo: body.acceso.tipo,
      valor: body.acceso.valor.trim(),
      nota: body.acceso.nota?.trim() || null,
      creado_por: user.id,
    };
    const { error } = await supabase.from("orden_acceso").insert(fila);
    // Sin la migración 0057 la base rechaza "pin" y "contrasena" (23514):
    // se guarda como "otro" con el tipo en la nota para no perder el acceso.
    if (error?.code === "23514" && fila.tipo !== "otro") {
      const etiqueta = fila.tipo === "pin" ? "PIN" : fila.tipo === "contrasena" ? "Contraseña" : "Patrón";
      await supabase
        .from("orden_acceso")
        .insert({ ...fila, tipo: "otro", nota: fila.nota ? `${etiqueta} · ${fila.nota}` : etiqueta });
    }
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

  // Subida de una recepción sin internet: el cliente ya se fue con su
  // comprobante (o sin él); solo se imprime la etiqueta del equipo.
  if (!subida) {
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
        // Hora de Colombia: el servidor está en UTC y de noche ponía el día siguiente.
        fecha: fechaHoraRecibo(new Date()),
        recibidoPor: perfil.nombre,
        urlSeguimiento,
        valorServicio: valorServicio || null,
        abono: abono && abonoRegistrado ? { monto: abono.monto, medio: abono.metodo.nombre } : null,
        saldo: valorServicio ? valorServicio - (abono && abonoRegistrado ? abono.monto : 0) : null,
      },
    });
  }

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
    carga: {
      codigoEntrada,
      producto: nombreProducto,
      numeroOrden: orden.numero,
      clienteNombre: cliente?.nombre ?? null,
      clienteTelefono: cliente?.telefono ?? null,
      valorServicio: valorServicio || null,
      motivo: body.motivo.trim(),
    },
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
    ...(avisos.length && { avisos }),
  });
}
