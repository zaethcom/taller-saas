/**
 * GET /api/ordenes/busqueda?q=<texto>
 *
 * El buscador de la barra superior: encuentra órdenes por número de
 * orden, código de entrada de la etiqueta, serial del equipo, documento
 * del cliente, teléfono del cliente o teléfono alterno de la orden. Las
 * reglas de comparación viven en lib/busqueda-orden.ts.
 *
 * Devuelve la lista (abiertas primero) y la pantalla decide: una sola
 * orden se abre directo, varias se muestran para elegir. No devuelve
 * teléfonos ni documentos, solo qué dato coincidió: el técnico también
 * busca aquí y no debe ver los datos del cliente (0003_vista_tecnico.sql).
 * RLS filtra por empresa.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { numeroDesdeCodigoEntrada } from "@/lib/codigo-entrada";
import { etiquetaEstado } from "@/lib/estados";
import {
  ETIQUETA_COINCIDENCIA,
  MIN_CARACTERES_DOCUMENTO,
  coincideDocumento,
  coincideTelefono,
  digitosTelefono,
  normalizarDocumento,
  numeroOrdenEscrito,
  ordenarResultados,
  patronFlexible,
  type Coincidencia,
} from "@/lib/busqueda-orden";

const MAXIMO = 20;

interface FilaOrden {
  id: string;
  numero: number;
  estado: string;
  abierta_en: string;
  cerrada_en: string | null;
  producto_id: string;
  producto: {
    marca: string | null;
    modelo: string | null;
    tipo: string;
    cliente: { nombre: string } | null;
  } | null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "escribe qué buscar" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  // id de orden -> qué datos coincidieron
  const coincidencias = new Map<string, Set<Coincidencia>>();
  const marcar = (ids: string[], c: Coincidencia) => {
    for (const id of ids) {
      if (!coincidencias.has(id)) coincidencias.set(id, new Set());
      coincidencias.get(id)!.add(c);
    }
  };
  // Equipos encontrados por serial: de esos solo interesa la orden abierta, si la hay.
  const productosPorSerial = new Set<string>();

  const documento = normalizarDocumento(q);
  const telefono = digitosTelefono(q);
  let numero = numeroOrdenEscrito(q);
  if (numero === null) {
    const { data: perfil } = await supabase.from("perfil").select("empresa_id").eq("id", user.id).single();
    const { data: config } = perfil
      ? await supabase.from("empresa_config").select("prefijo_etiqueta").eq("empresa_id", perfil.empresa_id).maybeSingle()
      : { data: null };
    numero = numeroDesdeCodigoEntrada(config?.prefijo_etiqueta, q);
  }

  const [porNumero, porSerial, porDocumento, porTelefono, porAlterno] = await Promise.all([
    numero !== null ? supabase.from("orden").select("id").eq("numero", numero) : null,
    supabase.from("producto").select("id").eq("serial", q),
    documento.length >= MIN_CARACTERES_DOCUMENTO
      ? supabase.from("cliente").select("id, documento").ilike("documento", patronFlexible(documento)).limit(50)
      : null,
    telefono
      ? supabase.from("cliente").select("id, telefono").ilike("telefono", patronFlexible(telefono)).limit(50)
      : null,
    telefono
      ? supabase.from("orden").select("id, telefono_alterno").ilike("telefono_alterno", patronFlexible(telefono)).limit(50)
      : null,
  ]);

  marcar((porNumero?.data ?? []).map((o) => o.id), "numero");
  marcar(
    (porAlterno?.data ?? []).filter((o) => telefono && coincideTelefono(o.telefono_alterno, telefono)).map((o) => o.id),
    "telefono_alterno",
  );
  for (const p of porSerial.data ?? []) productosPorSerial.add(p.id);

  // Clientes encontrados -> sus equipos -> sus órdenes.
  const clientesPor = new Map<string, Coincidencia>();
  for (const c of porDocumento?.data ?? []) {
    if (coincideDocumento(c.documento, documento)) clientesPor.set(c.id, "documento");
  }
  for (const c of porTelefono?.data ?? []) {
    if (telefono && coincideTelefono(c.telefono, telefono)) clientesPor.set(c.id, "telefono");
  }
  const productoACliente = new Map<string, string>();
  if (clientesPor.size > 0) {
    const { data: productos } = await supabase
      .from("producto")
      .select("id, cliente_id")
      .in("cliente_id", [...clientesPor.keys()]);
    for (const p of productos ?? []) productoACliente.set(p.id, p.cliente_id);
  }

  const productos = [...new Set([...productosPorSerial, ...productoACliente.keys()])];
  const consultas = [];
  if (productos.length > 0) {
    consultas.push(
      supabase
        .from("orden")
        .select("id, producto_id")
        .in("producto_id", productos)
        .order("abierta_en", { ascending: false })
        .limit(200),
    );
  }
  for (const r of await Promise.all(consultas)) {
    for (const o of r.data ?? []) {
      if (productosPorSerial.has(o.producto_id)) marcar([o.id], "serial");
      const cliente = productoACliente.get(o.producto_id);
      if (cliente) marcar([o.id], clientesPor.get(cliente)!);
    }
  }

  if (coincidencias.size === 0) {
    return NextResponse.json({ resultados: [] });
  }

  const { data } = await supabase
    .from("orden")
    .select(
      "id, numero, estado, abierta_en, cerrada_en, producto_id, producto:producto_id ( marca, modelo, tipo, cliente:cliente_id ( nombre ) )",
    )
    .in("id", [...coincidencias.keys()]);
  let filas = (data ?? []) as unknown as FilaOrden[];

  // Escanear el QR de un equipo abre su orden activa, no su historial:
  // si el único motivo es el serial y ese equipo tiene una abierta, las
  // cerradas sobran.
  const conAbierta = new Set(filas.filter((f) => !f.cerrada_en).map((f) => f.producto_id));
  filas = filas.filter((f) => {
    const motivos = coincidencias.get(f.id)!;
    const soloSerial = motivos.size === 1 && motivos.has("serial");
    return !(soloSerial && f.cerrada_en && conAbierta.has(f.producto_id));
  });

  const resultados = ordenarResultados(
    filas.map((f) => ({
      id: f.id,
      numero: f.numero,
      abierta: !f.cerrada_en,
      abiertaEn: f.abierta_en,
      coincide: [...coincidencias.get(f.id)!],
      estado: etiquetaEstado(f.estado),
      cliente: f.producto?.cliente?.nombre ?? null,
      equipo: [f.producto?.marca, f.producto?.modelo].filter(Boolean).join(" ") || f.producto?.tipo || null,
    })),
  )
    .slice(0, MAXIMO)
    .map((r) => ({ ...r, coincideTexto: r.coincide.map((c) => ETIQUETA_COINCIDENCIA[c]).join(", ") }));

  return NextResponse.json({ resultados });
}
