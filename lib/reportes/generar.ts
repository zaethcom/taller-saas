/**
 * Leer de la base lo que cada informe necesita y pasarlo al cálculo de
 * lib/reportes/informes.ts. Corre siempre con el cliente de la sesión
 * del usuario: RLS ya limita todo a su empresa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdInforme } from "./catalogo";
import { limitesUtc } from "./fechas";
import { fmtHoras } from "./formato";
import {
  articulosEnStock,
  cierresDeCaja,
  detalleVentas,
  inventarioRepuestos,
  kardex,
  ordenesTaller,
  productividadTecnicos,
  utilidadArticulos,
  ventasPorCategoria,
  ventasPorFecha,
  ventasPorHora,
  ventasPorMetodoPago,
  ventasPorProducto,
  ventasPorSede,
  ventasPorTipo,
  ventasPorVendedor,
  type Agrupacion,
  type ArticuloCat,
  type Catalogos,
  type ExistenciaFila,
  type ItemArticuloFila,
  type ItemFila,
  type MovimientoFila,
  type OrdenFila,
  type PagoFila,
  type PagoTurnoFila,
  type Persona,
  type RepuestoCat,
  type TurnoFila,
  type VentaFila,
} from "./informes";
import type { Informe } from "./tipos";

export interface Filtro {
  desde: string;
  hasta: string;
  /** null = todas las sedes que el usuario puede ver. */
  sedeId: string | null;
  agrupar: Agrupacion;
}

const PAGINA = 1000;

/**
 * PostgREST corta cada respuesta en 1000 filas: se pide de a páginas
 * hasta que una venga incompleta, para que un mes con mucho movimiento
 * no se quede a medias sin avisar.
 */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) return filas;
  }
}

async function catalogos(supabase: SupabaseClient): Promise<Catalogos> {
  const [personas, sedes, repuestos, articulos, categorias] = await Promise.all([
    todas<{ id: string } & Persona>((a, b) => supabase.from("perfil").select("id, nombre, codigo, rol").order("id").range(a, b)),
    todas<{ id: string; nombre: string }>((a, b) => supabase.from("sede").select("id, nombre").order("id").range(a, b)),
    todas<{ id: string } & RepuestoCat>((a, b) =>
      supabase.from("repuesto").select("id, codigo, descripcion, categoria_id, costo, precio_venta").order("id").range(a, b),
    ),
    todas<{ id: string } & ArticuloCat>((a, b) =>
      supabase
        .from("articulo")
        .select("id, numero, tipo, marca, modelo, categoria_id, costo, precio_venta, condicion, estado, sede_id")
        .order("id")
        .range(a, b),
    ),
    todas<{ id: string; nombre: string }>((a, b) => supabase.from("categoria").select("id, nombre").order("id").range(a, b)),
  ]);
  return {
    personas: new Map(personas.map(({ id, ...p }) => [id, p])),
    sedes: new Map(sedes.map((s) => [s.id, s.nombre])),
    repuestos: new Map(repuestos.map(({ id, ...r }) => [id, r])),
    articulos: new Map(articulos.map(({ id, ...a }) => [id, a])),
    categorias: new Map(categorias.map((c) => [c.id, c.nombre])),
  };
}

async function ventas(supabase: SupabaseClient, f: Filtro): Promise<VentaFila[]> {
  const { inicio, fin } = limitesUtc(f.desde, f.hasta);
  return todas<VentaFila>((a, b) => {
    let q = supabase
      .from("venta")
      .select("id, numero, sede_id, tipo, total, creada_por, creada_en, turno_id")
      .eq("anulada", false)
      .gte("creada_en", inicio)
      .lt("creada_en", fin);
    if (f.sedeId) q = q.eq("sede_id", f.sedeId);
    return q.order("creada_en").order("id").range(a, b);
  });
}

/** Los ítems de las ventas del rango, con datos de su venta aplanados. */
async function items(supabase: SupabaseClient, f: Filtro): Promise<ItemArticuloFila[]> {
  const { inicio, fin } = limitesUtc(f.desde, f.hasta);
  const filas = await todas<ItemFila & { id: string; venta: { creada_en: string; creada_por: string | null; numero: number } }>((a, b) => {
    let q = supabase
      .from("venta_item")
      .select("id, venta_id, repuesto_id, articulo_id, descripcion, cantidad, precio_unit, venta:venta_id!inner ( creada_en, creada_por, numero, sede_id, anulada )")
      .eq("venta.anulada", false)
      .gte("venta.creada_en", inicio)
      .lt("venta.creada_en", fin);
    if (f.sedeId) q = q.eq("venta.sede_id", f.sedeId);
    return q.order("id").range(a, b);
  });
  return filas.map(({ venta, ...i }) => ({ ...i, creada_en: venta.creada_en, creada_por: venta.creada_por, numero: venta.numero }));
}

async function pagos(supabase: SupabaseClient, f: Filtro): Promise<PagoFila[]> {
  const { inicio, fin } = limitesUtc(f.desde, f.hasta);
  return todas<PagoFila & { id: string }>((a, b) => {
    let q = supabase
      .from("pago")
      .select("id, venta_id, medio, monto, es_efectivo, venta:venta_id!inner ( creada_en, sede_id, anulada )")
      .eq("venta.anulada", false)
      .gte("venta.creada_en", inicio)
      .lt("venta.creada_en", fin);
    if (f.sedeId) q = q.eq("venta.sede_id", f.sedeId);
    return q.order("id").range(a, b);
  });
}

async function ordenes(supabase: SupabaseClient, f: Filtro): Promise<OrdenFila[]> {
  const { inicio, fin } = limitesUtc(f.desde, f.hasta);
  const filas = await todas<{
    numero: number;
    sede_id: string;
    estado: string;
    tecnico_id: string | null;
    abierta_en: string;
    cerrada_en: string | null;
    total: number | null;
    producto: { tipo: string | null; marca: string | null; modelo: string | null; cliente: { nombre: string } | null } | null;
  }>((a, b) => {
    let q = supabase
      .from("orden")
      .select("id, numero, sede_id, estado, tecnico_id, abierta_en, cerrada_en, total, producto:producto_id ( tipo, marca, modelo, cliente:cliente_id ( nombre ) )")
      .gte("abierta_en", inicio)
      .lt("abierta_en", fin);
    if (f.sedeId) q = q.eq("sede_id", f.sedeId);
    return q.order("abierta_en").order("id").range(a, b);
  });
  return filas.map(({ producto, ...o }) => ({
    ...o,
    equipo: [producto?.tipo, producto?.marca, producto?.modelo].filter(Boolean).join(" ") || "—",
    cliente: producto?.cliente?.nombre ?? "—",
  }));
}

async function metricasPiloto(supabase: SupabaseClient): Promise<Informe> {
  const { data: entregadas } = await supabase.from("orden").select("id").eq("estado", "entregada");
  const ids = (entregadas ?? []).map((o) => o.id as string);
  let evidencia: number | null = null;
  if (ids.length) {
    const { data: ev } = await supabase.from("evidencia").select("orden_id, fase").in("orden_id", ids).not("fase", "is", null);
    const porOrden = new Map<string, Set<string>>();
    for (const e of ev ?? []) {
      if (!porOrden.has(e.orden_id)) porOrden.set(e.orden_id, new Set());
      porOrden.get(e.orden_id)!.add(e.fase as string);
    }
    evidencia = Math.round((ids.filter((id) => porOrden.get(id)?.has("entrada") && porOrden.get(id)?.has("salida")).length / ids.length) * 100);
  }

  const { data: cot } = await supabase
    .from("cotizacion")
    .select("enviada_en, decidida_en")
    .eq("decision", "aprobada")
    .not("enviada_en", "is", null)
    .not("decidida_en", "is", null);
  const horasAprobacion = cot?.length
    ? cot.reduce((s, c) => s + (new Date(c.decidida_en).getTime() - new Date(c.enviada_en).getTime()) / 3_600_000, 0) / cot.length
    : null;

  const { data: falt } = await supabase
    .from("repuesto_solicitud")
    .select("creada_en, recibido_en")
    .eq("estado", "recibido")
    .not("recibido_en", "is", null);
  const a48 = falt?.length
    ? Math.round(
        (falt.filter((x) => (new Date(x.recibido_en).getTime() - new Date(x.creada_en).getTime()) / 3_600_000 <= 48).length / falt.length) * 100,
      )
    : null;

  return {
    titulo: "Métricas del piloto",
    resumen: [
      { rotulo: "Evidencia completa (entrada + salida)", valor: evidencia, formato: "porcentaje" },
      { rotulo: "Tiempo hasta aprobación", valor: horasAprobacion === null ? null : fmtHoras(horasAprobacion), formato: "texto" },
      { rotulo: "Faltantes resueltos en menos de 48 h", valor: a48, formato: "porcentaje" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "metrica", titulo: "Métrica", formato: "texto" },
          { clave: "base", titulo: "Sobre", formato: "texto" },
        ],
        filas: [
          { metrica: "Evidencia completa (entrada + salida)", base: `${ids.length} órdenes entregadas` },
          { metrica: "Tiempo hasta aprobación", base: `${cot?.length ?? 0} cotizaciones aprobadas` },
          { metrica: "Faltantes resueltos en menos de 48 h", base: `${falt?.length ?? 0} faltantes recibidos` },
        ],
      },
    ],
    notas: [
      "Tiempo de recepción (meta: menos de 3 minutos): el sistema no guarda el inicio y fin de la recepción; se mide con cronómetro, en persona, durante el piloto.",
    ],
  };
}

export async function generarInforme(supabase: SupabaseClient, id: IdInforme, f: Filtro): Promise<Informe> {
  const { inicio, fin } = limitesUtc(f.desde, f.hasta);

  switch (id) {
    case "ventas-fecha":
      return ventasPorFecha(await ventas(supabase, f), f, f.agrupar);
    case "ventas-vendedor": {
      const [v, c] = await Promise.all([ventas(supabase, f), catalogos(supabase)]);
      return ventasPorVendedor(v, c);
    }
    case "ventas-producto": {
      const [i, c] = await Promise.all([items(supabase, f), catalogos(supabase)]);
      return ventasPorProducto(i, c);
    }
    case "ventas-categoria": {
      const [i, c] = await Promise.all([items(supabase, f), catalogos(supabase)]);
      return ventasPorCategoria(i, c);
    }
    case "ventas-metodo-pago":
      return ventasPorMetodoPago(await pagos(supabase, f));
    case "ventas-sede": {
      const [v, c] = await Promise.all([ventas(supabase, f), catalogos(supabase)]);
      return ventasPorSede(v, c);
    }
    case "ventas-hora":
      return ventasPorHora(await ventas(supabase, f));
    case "ventas-tipo":
      return ventasPorTipo(await ventas(supabase, f));
    case "ventas-detalle": {
      const [v, p, i, c] = await Promise.all([ventas(supabase, f), pagos(supabase, f), items(supabase, f), catalogos(supabase)]);
      return detalleVentas(v, p, i, c);
    }
    case "utilidad-articulos": {
      const [i, c] = await Promise.all([items(supabase, f), catalogos(supabase)]);
      return utilidadArticulos(i, c);
    }
    case "cierres-caja": {
      const [turnos, c] = await Promise.all([
        todas<TurnoFila>((a, b) => {
          let q = supabase
            .from("turno_caja")
            .select("id, sede_id, abierto_por, abierto_en, base_inicial, cerrado_por, cerrado_en, efectivo_contado, diferencia")
            .gte("abierto_en", inicio)
            .lt("abierto_en", fin);
          if (f.sedeId) q = q.eq("sede_id", f.sedeId);
          return q.order("abierto_en").order("id").range(a, b);
        }),
        catalogos(supabase),
      ]);
      const pagosTurno: PagoTurnoFila[] = [];
      // De a 100 turnos por consulta: la lista de ids va en la URL.
      for (let k = 0; k < turnos.length; k += 100) {
        const lote = turnos.slice(k, k + 100).map((t) => t.id);
        const filas = await todas<{ monto: number; es_efectivo: boolean; venta: { turno_id: string } }>((a, b) =>
          supabase
            .from("pago")
            .select("id, monto, es_efectivo, venta:venta_id!inner ( turno_id, anulada )")
            .eq("venta.anulada", false)
            .in("venta.turno_id", lote)
            .order("id")
            .range(a, b),
        );
        pagosTurno.push(...filas.map((p) => ({ turno_id: p.venta.turno_id, monto: p.monto, es_efectivo: p.es_efectivo })));
      }
      return cierresDeCaja(turnos, pagosTurno, c);
    }
    case "inventario-repuestos": {
      const [existencias, c] = await Promise.all([
        todas<ExistenciaFila>((a, b) => {
          let q = supabase.from("existencia").select("repuesto_id, sede_id, cantidad");
          if (f.sedeId) q = q.eq("sede_id", f.sedeId);
          return q.order("repuesto_id").order("sede_id").range(a, b);
        }),
        catalogos(supabase),
      ]);
      return inventarioRepuestos(existencias, c);
    }
    case "articulos-stock":
      return articulosEnStock(await catalogos(supabase), f.sedeId);
    case "kardex": {
      const [movs, c] = await Promise.all([
        todas<MovimientoFila>((a, b) => {
          let q = supabase
            .from("movimiento_inventario")
            .select(
              "ocurrido_en, sede_id, repuesto_id, articulo_id, tipo, cantidad_anterior, cantidad_nueva, diferencia, estado_anterior, estado_nuevo, motivo, autor_id",
            )
            .gte("ocurrido_en", inicio)
            .lt("ocurrido_en", fin);
          if (f.sedeId) q = q.eq("sede_id", f.sedeId);
          return q.order("ocurrido_en").order("id").range(a, b);
        }),
        catalogos(supabase),
      ]);
      return kardex(movs, c);
    }
    case "ordenes-taller": {
      const [o, c] = await Promise.all([ordenes(supabase, f), catalogos(supabase)]);
      return ordenesTaller(o, c);
    }
    case "productividad-tecnicos": {
      const [o, c] = await Promise.all([ordenes(supabase, f), catalogos(supabase)]);
      const tecnicos = [...c.personas.entries()].filter(([, p]) => p.rol === "tecnico").map(([idTec]) => idTec);
      return productividadTecnicos(o, tecnicos, c);
    }
    case "metricas-piloto":
      return metricasPiloto(supabase);
  }
}
