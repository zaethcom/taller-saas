/**
 * GET /api/app/copia-local
 *
 * La copia de datos de la sede activa para trabajar sin internet (plan
 * sin internet, fase 2). La app la baja al abrir y cada pocos minutos
 * (componentes/sin-conexion/sincronizar-copia.tsx) y la guarda en
 * IndexedDB (lib/sin-conexion/copia-local.ts). Sin conexión, Vender
 * busca en esta copia (lib/sin-conexion/leer-api.ts).
 *
 * Trae lo mismo que ya ve quien vende, sin los límites de 15 de las
 * búsquedas: repuestos en venta con existencia en la sede (con lo
 * reservado ya descontado, igual que /api/repuestos?venta=1), artículos
 * en existencia en la sede, clientes y órdenes abiertas de la sede con
 * su cuenta (valor, abonos, saldo y lo usado), para cobrar sin conexión.
 * Nunca el costo de compra: eso es solo de administración.
 *
 * Todo pasa por RLS con la sesión del usuario: es su empresa y nada más.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { disponible } from "@/lib/reservas";
import { resumirCuenta } from "@/lib/cuenta-orden";
import type { CopiaLocal, CuentaOrdenLocal } from "@/lib/sin-conexion/tipos";

export const dynamic = "force-dynamic";

/** PostgREST corta en 1000 filas por respuesta: se pide por páginas. */
const PAGINA = 1000;
/** Tope de seguridad para que una empresa enorme no tumbe el teléfono. */
const MAXIMO_FILAS = 20000;

async function todas<T>(
  armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; desde < MAXIMO_FILAS; desde += PAGINA) {
    const { data, error } = await armar(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return filas;
}

type FilaRepuesto = {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  categoria_id: string | null;
  precio_venta: number | string;
  imagen_url: string | null;
  en_venta?: boolean | null;
  existencia: { cantidad: number; sede_id: string }[];
};

async function repuestosEnVenta(supabase: SupabaseClient, sedeId: string) {
  const armar = (conEnVenta: boolean) => (desde: number, hasta: number) => {
    let c = supabase
      .from("repuesto")
      .select(
        "id, codigo, descripcion, marca, modelo, categoria_id, precio_venta, imagen_url, existencia!inner ( cantidad, sede_id )",
      )
      .eq("existencia.sede_id", sedeId)
      .gt("existencia.cantidad", 0)
      .order("id")
      .range(desde, hasta);
    if (conEnVenta) c = c.eq("en_venta", true);
    return c as unknown as PromiseLike<{ data: FilaRepuesto[] | null; error: { message: string; code?: string } | null }>;
  };
  try {
    return await todas(armar(true));
  } catch {
    // Bases sin la columna en_venta todavía (igual que /api/repuestos).
    return await todas(armar(false));
  }
}

/** Cuántos ids caben en un `in (...)` sin que la URL quede demasiado larga. */
const LOTE_IDS = 100;

function lotes<T>(lista: T[]): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += LOTE_IDS) r.push(lista.slice(i, i + LOTE_IDS));
  return r;
}

type FilaOrden = {
  id: string;
  numero: number;
  estado: string;
  abierta_en: string;
  total: number | string | null;
  telefono_alterno: string | null;
  motivo: string | null;
  token_publico: string;
  producto: {
    cliente_id: string | null;
    serial: string | null;
    tipo: string | null;
    marca: string | null;
    modelo: string | null;
    cliente: { nombre: string; telefono: string | null } | null;
  } | null;
};

/**
 * La cuenta de cada orden abierta (fase 3b): lo mismo que calcula
 * lib/cuenta-orden.ts para una sola, pero en pocas consultas para todas.
 * Así Cobrar y entregar puede abrir la orden y recibir un abono sin
 * conexión.
 */
async function cuentasDeOrdenes(
  supabase: SupabaseClient,
  ordenes: FilaOrden[],
): Promise<Map<string, CuentaOrdenLocal>> {
  const ids = ordenes.map((o) => o.id);
  const items: { orden_id: string; descripcion: string; cantidad: number; precio_unit: number | string; repuesto_id: string | null }[] = [];
  const cotizaciones: { orden_id: string; total: number | string; decision: string | null; enviada_en: string }[] = [];
  const ventas: {
    orden_id: string;
    numero: number;
    tipo: string;
    total: number | string;
    creada_en: string;
    pago: { medio: string }[] | null;
  }[] = [];

  for (const lote of lotes(ids)) {
    const [ri, rc, rv] = await Promise.all([
      supabase.from("orden_item").select("orden_id, descripcion, cantidad, precio_unit, repuesto_id").in("orden_id", lote),
      supabase
        .from("cotizacion")
        .select("orden_id, total, decision, enviada_en")
        .in("orden_id", lote)
        .not("enviada_en", "is", null),
      supabase
        .from("venta")
        .select("orden_id, numero, tipo, total, creada_en, pago ( medio )")
        .in("orden_id", lote)
        .eq("anulada", false)
        .order("creada_en", { ascending: true }),
    ]);
    if (ri.error) throw new Error(ri.error.message);
    if (rc.error) throw new Error(rc.error.message);
    if (rv.error) throw new Error(rv.error.message);
    items.push(...(ri.data ?? []));
    cotizaciones.push(...(rc.data ?? []));
    ventas.push(...((rv.data ?? []) as typeof ventas));
  }

  // La cotización vigente es la última enviada (igual que obtenerCuentaOrden).
  const ultimaCotizacion = new Map<string, (typeof cotizaciones)[number]>();
  for (const c of cotizaciones) {
    const previa = ultimaCotizacion.get(c.orden_id);
    if (!previa || c.enviada_en > previa.enviada_en) ultimaCotizacion.set(c.orden_id, c);
  }

  const r = new Map<string, CuentaOrdenLocal>();
  for (const o of ordenes) {
    const cot = ultimaCotizacion.get(o.id);
    const totalCotizacion = cot && cot.decision !== "rechazada" ? Number(cot.total) : null;
    const pagos = ventas
      .filter((v) => v.orden_id === o.id)
      .map((v) => ({
        numero: v.numero,
        tipo: v.tipo,
        monto: Number(v.total),
        medio: (v.pago ?? [])[0]?.medio ?? null,
        fecha: v.creada_en,
      }));
    const cuenta = resumirCuenta(
      Number(o.total ?? 0),
      totalCotizacion,
      pagos.map((p) => ({ ...p, ventaId: "" })),
    );
    r.set(o.id, {
      motivo: o.motivo,
      tokenPublico: o.token_publico,
      clienteNombre: o.producto?.cliente?.nombre ?? null,
      clienteTelefono: o.producto?.cliente?.telefono ?? null,
      valor: cuenta.valor,
      pagado: cuenta.pagado,
      saldo: cuenta.saldo,
      pagos,
      items: items
        .filter((it) => it.orden_id === o.id)
        .map((it) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnit: Number(it.precio_unit),
          repuestoId: it.repuesto_id,
        })),
    });
  }
  return r;
}

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  const sedeId = perfil.sedeId;
  if (!sedeId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  try {
    const [repuestos, reservas, articulos, clientes, ordenes] = await Promise.all([
      repuestosEnVenta(supabase, sedeId),
      todas<{ repuesto_id: string; cantidad: number }>((d, h) =>
        supabase
          .from("repuesto_reserva")
          .select("repuesto_id, cantidad")
          .eq("sede_id", sedeId)
          .eq("estado", "activa")
          .order("id")
          .range(d, h),
      ),
      todas<{
        id: string;
        numero: number;
        tipo: string;
        marca: string | null;
        modelo: string | null;
        numero_serie: string | null;
        precio_venta: number | string;
        imagen_url: string | null;
        categoria_id: string | null;
      }>((d, h) =>
        supabase
          .from("articulo")
          .select("id, numero, tipo, marca, modelo, numero_serie, precio_venta, imagen_url, categoria_id")
          .eq("estado", "en_stock")
          .eq("sede_id", sedeId)
          .order("creado_en", { ascending: false })
          .range(d, h),
      ),
      todas<{ id: string; nombre: string; documento: string | null; telefono: string | null; correo: string | null }>((d, h) =>
        supabase.from("cliente").select("id, nombre, documento, telefono, correo").order("id").range(d, h),
      ),
      todas<FilaOrden>((d, h) =>
        supabase
          .from("orden")
          .select(
            "id, numero, estado, abierta_en, total, telefono_alterno, motivo, token_publico, producto:producto_id ( cliente_id, serial, tipo, marca, modelo, cliente:cliente_id ( nombre, telefono ) )",
          )
          .eq("sede_id", sedeId)
          .is("cerrada_en", null)
          .order("abierta_en", { ascending: false })
          .range(d, h) as unknown as PromiseLike<{ data: FilaOrden[] | null; error: { message: string } | null }>,
      ),
    ]);

    const [cuentas, { data: config }] = await Promise.all([
      cuentasDeOrdenes(supabase, ordenes),
      supabase.from("empresa_config").select("prefijo_etiqueta").eq("empresa_id", perfil.empresaId).maybeSingle(),
    ]);

    const reservado = new Map<string, number>();
    for (const r of reservas) reservado.set(r.repuesto_id, (reservado.get(r.repuesto_id) ?? 0) + r.cantidad);

    const copia: CopiaLocal = {
      version: 1,
      generadaEn: new Date().toISOString(),
      empresaId: perfil.empresaId,
      sedeId,
      usuarioId: perfil.id,
      repuestos: repuestos
        .map((r) => {
          const existencia = r.existencia.find((e) => e.sede_id === sedeId)?.cantidad ?? 0;
          const reservadoAqui = reservado.get(r.id) ?? 0;
          return {
            id: r.id,
            codigo: r.codigo,
            descripcion: r.descripcion,
            marca: r.marca,
            modelo: r.modelo,
            categoriaId: r.categoria_id,
            precioVenta: Number(r.precio_venta),
            imagenUrl: r.imagen_url,
            existenciaAqui: disponible(existencia, reservadoAqui),
            reservadoAqui,
          };
        })
        .filter((r) => r.existenciaAqui > 0),
      articulos: articulos.map((a) => ({
        id: a.id,
        numero: a.numero,
        codigo: `ART-${String(a.numero).padStart(6, "0")}`,
        tipo: a.tipo,
        marca: a.marca,
        modelo: a.modelo,
        numero_serie: a.numero_serie,
        precio_venta: Number(a.precio_venta),
        imagen_url: a.imagen_url,
        categoriaId: a.categoria_id,
      })),
      clientes,
      ordenesAbiertas: ordenes.map((o) => ({
        id: o.id,
        numero: o.numero,
        estado: o.estado,
        abiertaEn: o.abierta_en,
        total: o.total === null ? null : Number(o.total),
        telefonoAlterno: o.telefono_alterno,
        clienteId: o.producto?.cliente_id ?? null,
        serial: o.producto?.serial ?? null,
        tipo: o.producto?.tipo ?? null,
        marca: o.producto?.marca ?? null,
        modelo: o.producto?.modelo ?? null,
        cuenta: cuentas.get(o.id),
      })),
      prefijoEtiqueta: config?.prefijo_etiqueta ?? null,
      // Lo llena el navegador con /api/categorias, /api/metodos-pago y
      // /api/turno/actual, que ya devuelven todo sin límite.
      categorias: [],
      metodosPago: [],
      turno: null,
    };
    return NextResponse.json(copia, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "no se pudo armar la copia" }, { status: 500 });
  }
}
