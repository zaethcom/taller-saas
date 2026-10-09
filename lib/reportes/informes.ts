/**
 * El cálculo de cada informe, sin tocar la base: recibe filas ya leídas
 * (lib/reportes/datos.ts) y devuelve un Informe (lib/reportes/tipos.ts).
 * Separado así para poder probarlo con datos de ejemplo
 * (pruebas/reportes.test.ts) y para que pantalla, Excel y PDF salgan
 * del mismo número.
 */
import { efectivoEsperado } from "../caja";
import { ETIQUETA_ESTADO, type Estado } from "../estados";
import {
  DIAS_SEMANA,
  diaLocal,
  diaSemanaLocal,
  diasEntre,
  horaLocal,
  lunesDe,
  nombreMes,
  sumarDias,
} from "./fechas";
import type { Informe, Valor } from "./tipos";

// ── Filas crudas ────────────────────────────────────────────────────

export interface VentaFila {
  id: string;
  numero: number;
  sede_id: string;
  tipo: string;
  total: number;
  creada_por: string | null;
  creada_en: string;
  turno_id: string | null;
}

export interface ItemFila {
  venta_id: string;
  repuesto_id: string | null;
  articulo_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
}

export interface PagoFila {
  venta_id: string;
  medio: string;
  monto: number;
  es_efectivo: boolean;
}

export interface Persona {
  nombre: string;
  codigo: string | null;
  rol: string;
}

export interface RepuestoCat {
  codigo: string | null;
  descripcion: string;
  categoria_id: string | null;
  costo: number | null;
  precio_venta: number | null;
}

export interface ArticuloCat {
  numero: number | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  categoria_id: string | null;
  costo: number | null;
  precio_venta: number | null;
  condicion: string | null;
  estado: string;
  sede_id: string | null;
}

export interface Catalogos {
  personas: Map<string, Persona>;
  sedes: Map<string, string>;
  repuestos: Map<string, RepuestoCat>;
  articulos: Map<string, ArticuloCat>;
  categorias: Map<string, string>;
}

export interface Rango {
  desde: string;
  hasta: string;
}

// ── Utilidades ──────────────────────────────────────────────────────

const pct = (parte: number, total: number): number | null => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);

export function nombrePersona(c: Catalogos, id: string | null | undefined): string {
  if (!id) return "Sin usuario";
  const p = c.personas.get(id);
  if (!p) return "Usuario eliminado";
  return p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre;
}

function nombreSede(c: Catalogos, id: string | null | undefined): string {
  return (id && c.sedes.get(id)) || "—";
}

export function nombreArticulo(a: ArticuloCat): string {
  return [a.tipo, a.marca, a.modelo].filter(Boolean).join(" ") || "Artículo";
}

const ROLES: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  tecnico: "Técnico",
  compras: "Compras",
  cajero: "Cajero",
};

const TIPO_VENTA: Record<string, string> = { mostrador: "Mostrador", servicio: "Servicio (orden)" };

function etiquetaTipoMovimiento(tipo: string): string {
  const fijo: Record<string, string> = {
    venta: "Venta",
    consumo_orden: "Consumo en orden",
    recepcion: "Recepción",
    ajuste_manual: "Ajuste manual",
  };
  if (fijo[tipo]) return fijo[tipo];
  const t = tipo.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function resumenVentas(ventas: VentaFila[]) {
  const total = ventas.reduce((s, v) => s + Number(v.total), 0);
  return {
    total,
    cantidad: ventas.length,
    ticket: ventas.length ? total / ventas.length : null,
  };
}

function cifrasVentas(ventas: VentaFila[]): Informe["resumen"] {
  const r = resumenVentas(ventas);
  return [
    { rotulo: "Total vendido", valor: r.total, formato: "moneda" },
    { rotulo: "Ventas", valor: r.cantidad, formato: "numero" },
    { rotulo: "Ticket promedio", valor: r.ticket, formato: "moneda" },
  ];
}

// ── 1. Ventas por fecha ─────────────────────────────────────────────

export type Agrupacion = "dia" | "semana" | "mes";

export function ventasPorFecha(ventas: VentaFila[], rango: Rango, agrupar: Agrupacion): Informe {
  const claveDe = (dia: string) => (agrupar === "dia" ? dia : agrupar === "semana" ? lunesDe(dia) : dia.slice(0, 7));

  const grupos = new Map<string, { cantidad: number; total: number }>();
  // Los días/semanas/meses sin ventas también salen, en cero: un
  // calendario con huecos esconde justo los días flojos.
  if (diasEntre(rango.desde, rango.hasta) <= 731) {
    for (let d = rango.desde; d <= rango.hasta; d = sumarDias(d, 1)) {
      const k = claveDe(d);
      if (!grupos.has(k)) grupos.set(k, { cantidad: 0, total: 0 });
    }
  }
  for (const v of ventas) {
    const k = claveDe(diaLocal(v.creada_en));
    const g = grupos.get(k) ?? { cantidad: 0, total: 0 };
    g.cantidad += 1;
    g.total += Number(v.total);
    grupos.set(k, g);
  }

  const etiqueta = (k: string) =>
    agrupar === "dia"
      ? `${(DIAS_SEMANA[diaSemanaLocal(`${k}T17:00:00Z`)] ?? "").slice(0, 3)} ${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`
      : agrupar === "semana"
        ? `Semana del ${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`
        : nombreMes(k);

  const filas = [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, g]) => ({
      periodo: etiqueta(k),
      ventas: g.cantidad,
      total: g.total,
      ticket: g.cantidad ? g.total / g.cantidad : null,
    }));

  const r = resumenVentas(ventas);
  const dias = diasEntre(rango.desde, rango.hasta);
  return {
    titulo: "Ventas por fecha",
    resumen: [...cifrasVentas(ventas), { rotulo: "Promedio por día", valor: dias > 0 ? r.total / dias : null, formato: "moneda" }],
    tablas: [
      {
        columnas: [
          { clave: "periodo", titulo: agrupar === "dia" ? "Día" : agrupar === "semana" ? "Semana" : "Mes", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "ticket", titulo: "Ticket promedio", formato: "moneda" },
        ],
        filas,
        totales: { periodo: "Total", ventas: r.cantidad, total: r.total, ticket: r.ticket },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 2. Ventas por vendedor ──────────────────────────────────────────

export function ventasPorVendedor(ventas: VentaFila[], c: Catalogos): Informe {
  const grupos = new Map<string, { cantidad: number; total: number; mostrador: number; servicio: number }>();
  for (const v of ventas) {
    const k = v.creada_por ?? "";
    const g = grupos.get(k) ?? { cantidad: 0, total: 0, mostrador: 0, servicio: 0 };
    g.cantidad += 1;
    g.total += Number(v.total);
    if (v.tipo === "servicio") g.servicio += Number(v.total);
    else g.mostrador += Number(v.total);
    grupos.set(k, g);
  }
  const r = resumenVentas(ventas);
  const filas = [...grupos.entries()]
    .map(([id, g]) => ({
      vendedor: nombrePersona(c, id || null),
      rol: ROLES[c.personas.get(id)?.rol ?? ""] ?? "—",
      ventas: g.cantidad,
      mostrador: g.mostrador,
      servicio: g.servicio,
      total: g.total,
      ticket: g.cantidad ? g.total / g.cantidad : null,
      participacion: pct(g.total, r.total),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    titulo: "Ventas por vendedor",
    resumen: [...cifrasVentas(ventas), { rotulo: "Vendedores con ventas", valor: filas.length, formato: "numero" }],
    tablas: [
      {
        columnas: [
          { clave: "vendedor", titulo: "Vendedor", formato: "texto" },
          { clave: "rol", titulo: "Rol", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "mostrador", titulo: "Mostrador", formato: "moneda" },
          { clave: "servicio", titulo: "Servicio", formato: "moneda" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "ticket", titulo: "Ticket promedio", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas,
        totales: {
          vendedor: "Total",
          ventas: r.cantidad,
          mostrador: filas.reduce((s, f) => s + f.mostrador, 0),
          servicio: filas.reduce((s, f) => s + f.servicio, 0),
          total: r.total,
          ticket: r.ticket,
          participacion: r.total > 0 ? 100 : null,
        },
        barra: "total",
      },
    ],
    notas: [
      "El vendedor es el usuario que registró la venta en caja. Si cobra una persona distinta a la que atendió, la venta queda a nombre de quien cobró.",
    ],
  };
}

// ── 3. Ventas por producto ──────────────────────────────────────────

export function ventasPorProducto(items: ItemFila[], c: Catalogos): Informe {
  const grupos = new Map<string, { codigo: string; producto: string; tipo: string; unidades: number; total: number }>();
  for (const i of items) {
    let k: string;
    let base: { codigo: string; producto: string; tipo: string };
    if (i.repuesto_id) {
      const r = c.repuestos.get(i.repuesto_id);
      k = `r:${i.repuesto_id}`;
      base = { codigo: r?.codigo ?? "—", producto: r?.descripcion ?? i.descripcion, tipo: "Repuesto" };
    } else if (i.articulo_id) {
      const a = c.articulos.get(i.articulo_id);
      k = `a:${i.articulo_id}`;
      base = { codigo: a?.numero != null ? `#${a.numero}` : "—", producto: a ? nombreArticulo(a) : i.descripcion, tipo: "Artículo" };
    } else {
      k = `l:${i.descripcion.trim().toLowerCase()}`;
      base = { codigo: "—", producto: i.descripcion, tipo: "Servicio / otro" };
    }
    const g = grupos.get(k) ?? { ...base, unidades: 0, total: 0 };
    g.unidades += Number(i.cantidad);
    g.total += Number(i.cantidad) * Number(i.precio_unit);
    grupos.set(k, g);
  }
  const total = [...grupos.values()].reduce((s, g) => s + g.total, 0);
  const unidades = [...grupos.values()].reduce((s, g) => s + g.unidades, 0);
  const filas = [...grupos.values()]
    .map((g) => ({ ...g, participacion: pct(g.total, total) }))
    .sort((a, b) => b.total - a.total || b.unidades - a.unidades);

  return {
    titulo: "Ventas por producto",
    resumen: [
      { rotulo: "Total vendido", valor: total, formato: "moneda" },
      { rotulo: "Unidades", valor: unidades, formato: "numero" },
      { rotulo: "Productos distintos", valor: filas.length, formato: "numero" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "codigo", titulo: "Código", formato: "texto" },
          { clave: "producto", titulo: "Producto", formato: "texto" },
          { clave: "tipo", titulo: "Tipo", formato: "texto" },
          { clave: "unidades", titulo: "Unidades", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas,
        totales: { codigo: "Total", unidades, total, participacion: total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 4. Ventas por categoría ─────────────────────────────────────────

export function ventasPorCategoria(items: ItemFila[], c: Catalogos): Informe {
  const grupos = new Map<string, { unidades: number; total: number }>();
  for (const i of items) {
    const categoriaId = i.repuesto_id
      ? c.repuestos.get(i.repuesto_id)?.categoria_id
      : i.articulo_id
        ? c.articulos.get(i.articulo_id)?.categoria_id
        : null;
    const nombre = categoriaId ? (c.categorias.get(categoriaId) ?? "Sin categoría") : i.repuesto_id || i.articulo_id ? "Sin categoría" : "Servicios y otros";
    const g = grupos.get(nombre) ?? { unidades: 0, total: 0 };
    g.unidades += Number(i.cantidad);
    g.total += Number(i.cantidad) * Number(i.precio_unit);
    grupos.set(nombre, g);
  }
  const total = [...grupos.values()].reduce((s, g) => s + g.total, 0);
  const unidades = [...grupos.values()].reduce((s, g) => s + g.unidades, 0);
  const filas = [...grupos.entries()]
    .map(([categoria, g]) => ({ categoria, unidades: g.unidades, total: g.total, participacion: pct(g.total, total) }))
    .sort((a, b) => b.total - a.total);
  return {
    titulo: "Ventas por categoría",
    resumen: [
      { rotulo: "Total vendido", valor: total, formato: "moneda" },
      { rotulo: "Unidades", valor: unidades, formato: "numero" },
      { rotulo: "Categorías con ventas", valor: filas.length, formato: "numero" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "categoria", titulo: "Categoría", formato: "texto" },
          { clave: "unidades", titulo: "Unidades", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas,
        totales: { categoria: "Total", unidades, total, participacion: total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 5. Ventas por método de pago ────────────────────────────────────

export function ventasPorMetodoPago(pagos: PagoFila[]): Informe {
  const grupos = new Map<string, { efectivo: boolean; pagos: number; total: number }>();
  for (const p of pagos) {
    const g = grupos.get(p.medio) ?? { efectivo: p.es_efectivo, pagos: 0, total: 0 };
    g.pagos += 1;
    g.total += Number(p.monto);
    grupos.set(p.medio, g);
  }
  const total = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const efectivo = pagos.filter((p) => p.es_efectivo).reduce((s, p) => s + Number(p.monto), 0);
  const filas = [...grupos.entries()]
    .map(([metodo, g]) => ({ metodo, efectivo: g.efectivo ? "Sí" : "No", pagos: g.pagos, total: g.total, participacion: pct(g.total, total) }))
    .sort((a, b) => b.total - a.total);
  return {
    titulo: "Ventas por método de pago",
    resumen: [
      { rotulo: "Total cobrado", valor: total, formato: "moneda" },
      { rotulo: "En efectivo", valor: efectivo, formato: "moneda" },
      { rotulo: "Otros medios", valor: total - efectivo, formato: "moneda" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "metodo", titulo: "Método de pago", formato: "texto" },
          { clave: "efectivo", titulo: "Es efectivo", formato: "texto" },
          { clave: "pagos", titulo: "Pagos", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas,
        totales: { metodo: "Total", pagos: pagos.length, total, participacion: total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 6. Ventas por sede ──────────────────────────────────────────────

export function ventasPorSede(ventas: VentaFila[], c: Catalogos): Informe {
  const grupos = new Map<string, { cantidad: number; total: number }>();
  for (const v of ventas) {
    const g = grupos.get(v.sede_id) ?? { cantidad: 0, total: 0 };
    g.cantidad += 1;
    g.total += Number(v.total);
    grupos.set(v.sede_id, g);
  }
  const r = resumenVentas(ventas);
  const filas = [...grupos.entries()]
    .map(([id, g]) => ({
      sede: nombreSede(c, id),
      ventas: g.cantidad,
      total: g.total,
      ticket: g.cantidad ? g.total / g.cantidad : null,
      participacion: pct(g.total, r.total),
    }))
    .sort((a, b) => b.total - a.total);
  return {
    titulo: "Ventas por sede",
    resumen: cifrasVentas(ventas),
    tablas: [
      {
        columnas: [
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "ticket", titulo: "Ticket promedio", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas,
        totales: { sede: "Total", ventas: r.cantidad, total: r.total, ticket: r.ticket, participacion: r.total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 7. Horas pico ───────────────────────────────────────────────────

export function ventasPorHora(ventas: VentaFila[]): Informe {
  const horas = Array.from({ length: 24 }, () => ({ cantidad: 0, total: 0 }));
  const dias = Array.from({ length: 7 }, () => ({ cantidad: 0, total: 0 }));
  for (const v of ventas) {
    const h = horas[horaLocal(v.creada_en)]!;
    h.cantidad += 1;
    h.total += Number(v.total);
    const d = dias[diaSemanaLocal(v.creada_en)]!;
    d.cantidad += 1;
    d.total += Number(v.total);
  }
  const r = resumenVentas(ventas);
  const pico = horas.reduce((mejor, h, i) => (h.cantidad > horas[mejor]!.cantidad ? i : mejor), 0);
  const diaPico = dias.reduce((mejor, d, i) => (d.total > dias[mejor]!.total ? i : mejor), 0);
  const dos = (n: number) => String(n).padStart(2, "0");

  // Solo las horas con movimiento (o entre la primera y la última):
  // 24 filas con la madrugada en cero no le dicen nada a nadie.
  const conVentas = horas.map((h, i) => (h.cantidad > 0 ? i : -1)).filter((i) => i >= 0);
  const primera = conVentas[0] ?? 8;
  const ultima = conVentas[conVentas.length - 1] ?? 18;

  return {
    titulo: "Horas y días pico",
    resumen: [
      ...cifrasVentas(ventas),
      { rotulo: "Hora con más ventas", valor: ventas.length ? `${dos(pico)}:00 – ${dos(pico)}:59` : null, formato: "texto" },
      { rotulo: "Día más fuerte", valor: ventas.length ? (DIAS_SEMANA[diaPico] ?? null) : null, formato: "texto" },
    ],
    tablas: [
      {
        titulo: "Por hora del día",
        columnas: [
          { clave: "hora", titulo: "Hora", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas: horas
          .map((h, i) => ({ i, hora: `${dos(i)}:00 – ${dos(i)}:59`, ventas: h.cantidad, total: h.total, participacion: pct(h.total, r.total) }))
          .filter((f) => f.i >= primera && f.i <= ultima)
          .map(({ hora, ventas: n, total, participacion }) => ({ hora, ventas: n, total, participacion })),
        totales: { hora: "Total", ventas: r.cantidad, total: r.total, participacion: r.total > 0 ? 100 : null },
        barra: "total",
      },
      {
        titulo: "Por día de la semana",
        columnas: [
          { clave: "dia", titulo: "Día", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas: dias.map((d, i) => ({ dia: DIAS_SEMANA[i] ?? "", ventas: d.cantidad, total: d.total, participacion: pct(d.total, r.total) })),
        totales: { dia: "Total", ventas: r.cantidad, total: r.total, participacion: r.total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 8. Mostrador vs. servicio ───────────────────────────────────────

export function ventasPorTipo(ventas: VentaFila[]): Informe {
  const grupos = new Map<string, { cantidad: number; total: number }>();
  for (const v of ventas) {
    const g = grupos.get(v.tipo) ?? { cantidad: 0, total: 0 };
    g.cantidad += 1;
    g.total += Number(v.total);
    grupos.set(v.tipo, g);
  }
  const r = resumenVentas(ventas);
  return {
    titulo: "Mostrador vs. servicio",
    resumen: [
      { rotulo: "Total vendido", valor: r.total, formato: "moneda" },
      { rotulo: "Mostrador", valor: grupos.get("mostrador")?.total ?? 0, formato: "moneda" },
      { rotulo: "Servicio (órdenes)", valor: grupos.get("servicio")?.total ?? 0, formato: "moneda" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "tipo", titulo: "Tipo de venta", formato: "texto" },
          { clave: "ventas", titulo: "Ventas", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
          { clave: "ticket", titulo: "Ticket promedio", formato: "moneda" },
          { clave: "participacion", titulo: "% del total", formato: "porcentaje" },
        ],
        filas: [...grupos.entries()]
          .map(([tipo, g]) => ({
            tipo: TIPO_VENTA[tipo] ?? tipo,
            ventas: g.cantidad,
            total: g.total,
            ticket: g.cantidad ? g.total / g.cantidad : null,
            participacion: pct(g.total, r.total),
          }))
          .sort((a, b) => b.total - a.total),
        totales: { tipo: "Total", ventas: r.cantidad, total: r.total, ticket: r.ticket, participacion: r.total > 0 ? 100 : null },
        barra: "total",
      },
    ],
    notas: [],
  };
}

// ── 9. Detalle de ventas ────────────────────────────────────────────

export function detalleVentas(ventas: VentaFila[], pagos: PagoFila[], items: ItemFila[], c: Catalogos): Informe {
  const mediosPorVenta = new Map<string, Set<string>>();
  for (const p of pagos) {
    if (!mediosPorVenta.has(p.venta_id)) mediosPorVenta.set(p.venta_id, new Set());
    mediosPorVenta.get(p.venta_id)!.add(p.medio);
  }
  const unidadesPorVenta = new Map<string, number>();
  for (const i of items) unidadesPorVenta.set(i.venta_id, (unidadesPorVenta.get(i.venta_id) ?? 0) + Number(i.cantidad));

  const filas = [...ventas]
    .sort((a, b) => b.creada_en.localeCompare(a.creada_en))
    .map((v) => ({
      numero: v.numero,
      fecha: v.creada_en,
      sede: nombreSede(c, v.sede_id),
      vendedor: nombrePersona(c, v.creada_por),
      tipo: TIPO_VENTA[v.tipo] ?? v.tipo,
      metodo: [...(mediosPorVenta.get(v.id) ?? [])].join(", ") || "—",
      unidades: unidadesPorVenta.get(v.id) ?? 0,
      total: Number(v.total),
    }));
  const r = resumenVentas(ventas);
  return {
    titulo: "Detalle de ventas",
    resumen: cifrasVentas(ventas),
    tablas: [
      {
        columnas: [
          { clave: "numero", titulo: "N.º", formato: "texto" },
          { clave: "fecha", titulo: "Fecha", formato: "fechaHora" },
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "vendedor", titulo: "Vendedor", formato: "texto" },
          { clave: "tipo", titulo: "Tipo", formato: "texto" },
          { clave: "metodo", titulo: "Método de pago", formato: "texto" },
          { clave: "unidades", titulo: "Unidades", formato: "numero" },
          { clave: "total", titulo: "Total", formato: "moneda" },
        ],
        filas,
        totales: { numero: "Total", unidades: filas.reduce((s, f) => s + f.unidades, 0), total: r.total },
      },
    ],
    notas: [],
  };
}

// ── 10. Cierres de caja ─────────────────────────────────────────────

export interface TurnoFila {
  id: string;
  sede_id: string;
  abierto_por: string | null;
  abierto_en: string;
  base_inicial: number;
  cerrado_por: string | null;
  cerrado_en: string | null;
  efectivo_contado: number | null;
  diferencia: number | null;
}

/** pagos de ventas no anuladas, con el turno de su venta. */
export interface PagoTurnoFila {
  turno_id: string;
  monto: number;
  es_efectivo: boolean;
}

export function cierresDeCaja(turnos: TurnoFila[], pagos: PagoTurnoFila[], c: Catalogos): Informe {
  const porTurno = new Map<string, { total: number; efectivo: number }>();
  for (const p of pagos) {
    const g = porTurno.get(p.turno_id) ?? { total: 0, efectivo: 0 };
    g.total += Number(p.monto);
    if (p.es_efectivo) g.efectivo += Number(p.monto);
    porTurno.set(p.turno_id, g);
  }

  const filas = [...turnos]
    .sort((a, b) => b.abierto_en.localeCompare(a.abierto_en))
    .map((t) => {
      const v = porTurno.get(t.id) ?? { total: 0, efectivo: 0 };
      const esperado = efectivoEsperado({ baseInicial: Number(t.base_inicial), ventasEfectivo: v.efectivo, aperturasManualesEfectivo: 0 });
      return {
        sede: nombreSede(c, t.sede_id),
        apertura: t.abierto_en,
        abrio: nombrePersona(c, t.abierto_por),
        cierre: t.cerrado_en ?? "Abierto",
        cerro: t.cerrado_en ? nombrePersona(c, t.cerrado_por) : "—",
        base: Number(t.base_inicial),
        ventas: v.total,
        efectivo: v.efectivo,
        esperado,
        contado: t.efectivo_contado === null ? null : Number(t.efectivo_contado),
        diferencia: t.diferencia === null ? null : Number(t.diferencia),
      };
    });

  const cerrados = filas.filter((f) => f.diferencia !== null);
  const descuadre = cerrados.reduce((s, f) => s + (f.diferencia ?? 0), 0);
  return {
    titulo: "Cierres de caja",
    resumen: [
      { rotulo: "Turnos", valor: filas.length, formato: "numero" },
      { rotulo: "Vendido en los turnos", valor: filas.reduce((s, f) => s + f.ventas, 0), formato: "moneda" },
      { rotulo: "Turnos con descuadre", valor: cerrados.filter((f) => f.diferencia !== 0).length, formato: "numero" },
      { rotulo: "Descuadre neto", valor: descuadre, formato: "moneda" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "apertura", titulo: "Apertura", formato: "fechaHora" },
          { clave: "abrio", titulo: "Abrió", formato: "texto" },
          { clave: "cierre", titulo: "Cierre", formato: "fechaHora" },
          { clave: "cerro", titulo: "Cerró", formato: "texto" },
          { clave: "base", titulo: "Base", formato: "moneda" },
          { clave: "ventas", titulo: "Ventas", formato: "moneda" },
          { clave: "efectivo", titulo: "Ventas en efectivo", formato: "moneda" },
          { clave: "esperado", titulo: "Efectivo esperado", formato: "moneda" },
          { clave: "contado", titulo: "Efectivo contado", formato: "moneda" },
          { clave: "diferencia", titulo: "Diferencia", formato: "moneda" },
        ],
        filas,
        totales: {
          sede: "Total",
          ventas: filas.reduce((s, f) => s + f.ventas, 0),
          efectivo: filas.reduce((s, f) => s + f.efectivo, 0),
          diferencia: descuadre,
        },
      },
    ],
    notas: ["Diferencia positiva: sobró efectivo. Negativa: faltó."],
  };
}

// ── 11. Inventario de repuestos ─────────────────────────────────────

export interface ExistenciaFila {
  repuesto_id: string;
  sede_id: string;
  cantidad: number;
}

export function inventarioRepuestos(existencias: ExistenciaFila[], c: Catalogos): Informe {
  const filas = existencias
    .map((e) => {
      const r = c.repuestos.get(e.repuesto_id);
      const precio = r?.precio_venta ?? null;
      const costo = r?.costo ?? null;
      return {
        codigo: r?.codigo ?? "—",
        repuesto: r?.descripcion ?? "Repuesto eliminado",
        categoria: (r?.categoria_id && c.categorias.get(r.categoria_id)) || "Sin categoría",
        sede: nombreSede(c, e.sede_id),
        cantidad: Number(e.cantidad),
        costo,
        precio,
        valorCosto: costo === null ? null : costo * Number(e.cantidad),
        valorVenta: precio === null ? null : precio * Number(e.cantidad),
      };
    })
    .sort((a, b) => a.cantidad - b.cantidad || a.repuesto.localeCompare(b.repuesto, "es"));

  const unidades = filas.reduce((s, f) => s + Math.max(0, f.cantidad), 0);
  const valorVenta = filas.reduce((s, f) => s + Math.max(0, f.valorVenta ?? 0), 0);
  const conCosto = filas.filter((f) => f.costo !== null);
  const valorCosto = conCosto.reduce((s, f) => s + Math.max(0, f.valorCosto ?? 0), 0);
  const notas: string[] = [];
  if (filas.length && conCosto.length < filas.length) {
    notas.push(
      `${filas.length - conCosto.length} de ${filas.length} filas no tienen costo registrado en el repuesto; el valor a costo solo suma las que sí.`,
    );
  }
  return {
    titulo: "Inventario de repuestos",
    resumen: [
      { rotulo: "Referencias", valor: filas.length, formato: "numero" },
      { rotulo: "Unidades", valor: unidades, formato: "numero" },
      { rotulo: "Sin existencias", valor: filas.filter((f) => f.cantidad <= 0).length, formato: "numero" },
      { rotulo: "Valor a precio de venta", valor: valorVenta, formato: "moneda" },
      { rotulo: "Valor a costo", valor: conCosto.length ? valorCosto : null, formato: "moneda" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "codigo", titulo: "Código", formato: "texto" },
          { clave: "repuesto", titulo: "Repuesto", formato: "texto" },
          { clave: "categoria", titulo: "Categoría", formato: "texto" },
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "cantidad", titulo: "Existencia", formato: "numero" },
          { clave: "costo", titulo: "Costo", formato: "moneda" },
          { clave: "precio", titulo: "Precio venta", formato: "moneda" },
          { clave: "valorVenta", titulo: "Valor a precio de venta", formato: "moneda" },
        ],
        filas,
        totales: { codigo: "Total", cantidad: unidades, valorVenta },
      },
    ],
    notas: ["Ordenado de menor a mayor existencia: arriba lo que hay que reponer.", ...notas],
  };
}

// ── 12. Artículos en stock ──────────────────────────────────────────

export function articulosEnStock(c: Catalogos, sedeId: string | null): Informe {
  const filas = [...c.articulos.values()]
    .filter((a) => a.estado === "en_stock" && (!sedeId || a.sede_id === sedeId))
    .map((a) => {
      const costo = a.costo === null ? null : Number(a.costo);
      const precio = a.precio_venta === null ? null : Number(a.precio_venta);
      return {
        numero: a.numero != null ? `#${a.numero}` : "—",
        articulo: nombreArticulo(a),
        categoria: (a.categoria_id && c.categorias.get(a.categoria_id)) || "Sin categoría",
        condicion: a.condicion ? a.condicion.charAt(0).toUpperCase() + a.condicion.slice(1) : "—",
        sede: nombreSede(c, a.sede_id),
        costo,
        precio,
        utilidad: costo !== null && precio !== null ? precio - costo : null,
        margen: costo !== null && precio ? pct(precio - costo, precio) : null,
      };
    })
    .sort((a, b) => a.articulo.localeCompare(b.articulo, "es"));
  const costo = filas.reduce((s, f) => s + (f.costo ?? 0), 0);
  const precio = filas.reduce((s, f) => s + (f.precio ?? 0), 0);
  return {
    titulo: "Artículos en stock",
    resumen: [
      { rotulo: "Artículos", valor: filas.length, formato: "numero" },
      { rotulo: "Valor a costo", valor: costo, formato: "moneda" },
      { rotulo: "Valor a precio de venta", valor: precio, formato: "moneda" },
      { rotulo: "Utilidad esperada", valor: precio - costo, formato: "moneda" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "numero", titulo: "N.º", formato: "texto" },
          { clave: "articulo", titulo: "Artículo", formato: "texto" },
          { clave: "categoria", titulo: "Categoría", formato: "texto" },
          { clave: "condicion", titulo: "Condición", formato: "texto" },
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "costo", titulo: "Costo", formato: "moneda" },
          { clave: "precio", titulo: "Precio venta", formato: "moneda" },
          { clave: "utilidad", titulo: "Utilidad", formato: "moneda" },
          { clave: "margen", titulo: "Margen", formato: "porcentaje" },
        ],
        filas,
        totales: { numero: "Total", costo, precio, utilidad: precio - costo, margen: pct(precio - costo, precio) },
      },
    ],
    notas: ["Foto del inventario a hoy: no depende del rango de fechas."],
  };
}

// ── 13. Movimientos de inventario (kardex) ──────────────────────────

export interface MovimientoFila {
  ocurrido_en: string;
  sede_id: string | null;
  repuesto_id: string | null;
  articulo_id: string | null;
  tipo: string;
  cantidad_anterior: number | null;
  cantidad_nueva: number | null;
  diferencia: number | null;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  motivo: string | null;
  autor_id: string | null;
}

export function kardex(movimientos: MovimientoFila[], c: Catalogos): Informe {
  const filas = [...movimientos]
    .sort((a, b) => b.ocurrido_en.localeCompare(a.ocurrido_en))
    .map((m) => {
      const r = m.repuesto_id ? c.repuestos.get(m.repuesto_id) : undefined;
      const a = m.articulo_id ? c.articulos.get(m.articulo_id) : undefined;
      return {
        fecha: m.ocurrido_en,
        sede: nombreSede(c, m.sede_id),
        codigo: r?.codigo ?? (a?.numero != null ? `#${a.numero}` : "—"),
        producto: r?.descripcion ?? (a ? nombreArticulo(a) : "—"),
        tipo: etiquetaTipoMovimiento(m.tipo),
        anterior: m.cantidad_anterior ?? m.estado_anterior,
        nueva: m.cantidad_nueva ?? m.estado_nuevo,
        diferencia: m.diferencia,
        motivo: m.motivo ?? "",
        usuario: nombrePersona(c, m.autor_id),
      } satisfies Record<string, Valor>;
    });
  const entradas = movimientos.reduce((s, m) => s + Math.max(0, m.diferencia ?? 0), 0);
  const salidas = movimientos.reduce((s, m) => s + Math.min(0, m.diferencia ?? 0), 0);
  return {
    titulo: "Movimientos de inventario (kardex)",
    resumen: [
      { rotulo: "Movimientos", valor: filas.length, formato: "numero" },
      { rotulo: "Unidades que entraron", valor: entradas, formato: "numero" },
      { rotulo: "Unidades que salieron", valor: -salidas, formato: "numero" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "fecha", titulo: "Fecha", formato: "fechaHora" },
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "codigo", titulo: "Código", formato: "texto" },
          { clave: "producto", titulo: "Producto", formato: "texto" },
          { clave: "tipo", titulo: "Movimiento", formato: "texto" },
          { clave: "anterior", titulo: "Antes", formato: "numero" },
          { clave: "nueva", titulo: "Después", formato: "numero" },
          { clave: "diferencia", titulo: "Diferencia", formato: "numero" },
          { clave: "motivo", titulo: "Motivo", formato: "texto" },
          { clave: "usuario", titulo: "Usuario", formato: "texto" },
        ],
        filas,
      },
    ],
    notas: [],
  };
}

// ── 14. Órdenes del taller ──────────────────────────────────────────

export interface OrdenFila {
  numero: number;
  sede_id: string;
  estado: string;
  tecnico_id: string | null;
  abierta_en: string;
  cerrada_en: string | null;
  total: number | null;
  equipo: string;
  cliente: string;
}

const HORAS = (desde: string, hasta: string) => (new Date(hasta).getTime() - new Date(desde).getTime()) / 3_600_000;

export function ordenesTaller(ordenes: OrdenFila[], c: Catalogos, ahora: Date = new Date()): Informe {
  const porEstado = new Map<string, { cantidad: number; total: number }>();
  for (const o of ordenes) {
    const g = porEstado.get(o.estado) ?? { cantidad: 0, total: 0 };
    g.cantidad += 1;
    g.total += Number(o.total ?? 0);
    porEstado.set(o.estado, g);
  }
  const entregadas = ordenes.filter((o) => o.estado === "entregada" && o.cerrada_en);
  const promedio = entregadas.length
    ? entregadas.reduce((s, o) => s + HORAS(o.abierta_en, o.cerrada_en!), 0) / entregadas.length
    : null;
  const etiqueta = (e: string) => ETIQUETA_ESTADO[e as Estado] ?? e;
  const totalCotizado = ordenes.reduce((s, o) => s + Number(o.total ?? 0), 0);

  return {
    titulo: "Órdenes del taller",
    resumen: [
      { rotulo: "Órdenes recibidas", valor: ordenes.length, formato: "numero" },
      { rotulo: "Entregadas", valor: entregadas.length, formato: "numero" },
      { rotulo: "En curso", valor: ordenes.filter((o) => o.estado !== "entregada" && o.estado !== "rechazada").length, formato: "numero" },
      { rotulo: "Tiempo promedio de reparación", valor: promedio, formato: "horas" },
      { rotulo: "Valor de las órdenes", valor: totalCotizado, formato: "moneda" },
    ],
    tablas: [
      {
        titulo: "Por estado",
        columnas: [
          { clave: "estado", titulo: "Estado", formato: "texto" },
          { clave: "ordenes", titulo: "Órdenes", formato: "numero" },
          { clave: "total", titulo: "Valor", formato: "moneda" },
        ],
        filas: [...porEstado.entries()]
          .map(([e, g]) => ({ estado: etiqueta(e), ordenes: g.cantidad, total: g.total }))
          .sort((a, b) => b.ordenes - a.ordenes),
        totales: { estado: "Total", ordenes: ordenes.length, total: totalCotizado },
        barra: "ordenes",
      },
      {
        titulo: "Listado",
        columnas: [
          { clave: "numero", titulo: "Orden", formato: "texto" },
          { clave: "abierta", titulo: "Recibida", formato: "fechaHora" },
          { clave: "sede", titulo: "Sede", formato: "texto" },
          { clave: "cliente", titulo: "Cliente", formato: "texto" },
          { clave: "equipo", titulo: "Equipo", formato: "texto" },
          { clave: "estado", titulo: "Estado", formato: "texto" },
          { clave: "tecnico", titulo: "Técnico", formato: "texto" },
          { clave: "tiempo", titulo: "Tiempo", formato: "horas" },
          { clave: "total", titulo: "Valor", formato: "moneda" },
        ],
        filas: [...ordenes]
          .sort((a, b) => b.abierta_en.localeCompare(a.abierta_en))
          .map((o) => ({
            numero: `#${o.numero}`,
            abierta: o.abierta_en,
            sede: nombreSede(c, o.sede_id),
            cliente: o.cliente,
            equipo: o.equipo,
            estado: etiqueta(o.estado),
            tecnico: o.tecnico_id ? nombrePersona(c, o.tecnico_id) : "Sin asignar",
            tiempo: HORAS(o.abierta_en, o.cerrada_en ?? ahora.toISOString()),
            total: o.total === null ? null : Number(o.total),
          })),
      },
    ],
    notas: ["Tiempo: de la recepción a la entrega; si la orden sigue abierta, hasta hoy."],
  };
}

// ── 15. Productividad por técnico ───────────────────────────────────

export function productividadTecnicos(ordenes: OrdenFila[], tecnicos: string[], c: Catalogos): Informe {
  const ids = new Set([...tecnicos, ...ordenes.map((o) => o.tecnico_id).filter((t): t is string => !!t)]);
  const filas = [...ids]
    .map((id) => {
      const propias = ordenes.filter((o) => o.tecnico_id === id);
      const terminadas = propias.filter((o) => o.estado === "entregada" && o.cerrada_en);
      return {
        tecnico: nombrePersona(c, id),
        asignados: propias.length,
        terminados: terminadas.length,
        enCurso: propias.length - terminadas.length,
        horas: terminadas.length ? terminadas.reduce((s, o) => s + HORAS(o.abierta_en, o.cerrada_en!), 0) / terminadas.length : null,
        valor: terminadas.reduce((s, o) => s + Number(o.total ?? 0), 0),
      };
    })
    .sort((a, b) => b.terminados - a.terminados || b.asignados - a.asignados);
  return {
    titulo: "Productividad por técnico",
    resumen: [
      { rotulo: "Técnicos", valor: filas.length, formato: "numero" },
      { rotulo: "Equipos asignados", valor: filas.reduce((s, f) => s + f.asignados, 0), formato: "numero" },
      { rotulo: "Equipos terminados", valor: filas.reduce((s, f) => s + f.terminados, 0), formato: "numero" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "tecnico", titulo: "Técnico", formato: "texto" },
          { clave: "asignados", titulo: "Asignados", formato: "numero" },
          { clave: "terminados", titulo: "Terminados", formato: "numero" },
          { clave: "enCurso", titulo: "En curso", formato: "numero" },
          { clave: "horas", titulo: "Tiempo promedio", formato: "horas" },
          { clave: "valor", titulo: "Valor entregado", formato: "moneda" },
        ],
        filas,
        barra: "terminados",
      },
    ],
    notas: ["Cuenta las órdenes recibidas en el rango. El técnico se asigna cuando la orden pasa a diagnóstico."],
  };
}

// ── 16. Utilidad de artículos ───────────────────────────────────────

export interface ItemArticuloFila extends ItemFila {
  creada_en: string;
  creada_por: string | null;
  numero: number;
}

export function utilidadArticulos(items: ItemArticuloFila[], c: Catalogos): Informe {
  const filas = [...items]
    .filter((i) => i.articulo_id)
    .sort((a, b) => b.creada_en.localeCompare(a.creada_en))
    .map((i) => {
      const a = c.articulos.get(i.articulo_id!);
      const precio = Number(i.cantidad) * Number(i.precio_unit);
      const costo = a?.costo == null ? null : Number(a.costo) * Number(i.cantidad);
      return {
        fecha: i.creada_en,
        venta: `#${i.numero}`,
        articulo: a ? nombreArticulo(a) : i.descripcion,
        vendedor: nombrePersona(c, i.creada_por),
        precio,
        costo,
        utilidad: costo === null ? null : precio - costo,
        margen: costo === null ? null : pct(precio - costo, precio),
      };
    });
  const conCosto = filas.filter((f) => f.costo !== null);
  const venta = conCosto.reduce((s, f) => s + f.precio, 0);
  const costo = conCosto.reduce((s, f) => s + (f.costo ?? 0), 0);
  return {
    titulo: "Utilidad de artículos vendidos",
    resumen: [
      { rotulo: "Artículos vendidos", valor: filas.length, formato: "numero" },
      { rotulo: "Vendido", valor: filas.reduce((s, f) => s + f.precio, 0), formato: "moneda" },
      { rotulo: "Costo", valor: costo, formato: "moneda" },
      { rotulo: "Utilidad bruta", valor: venta - costo, formato: "moneda" },
      { rotulo: "Margen", valor: pct(venta - costo, venta), formato: "porcentaje" },
    ],
    tablas: [
      {
        columnas: [
          { clave: "fecha", titulo: "Fecha", formato: "fechaHora" },
          { clave: "venta", titulo: "Venta", formato: "texto" },
          { clave: "articulo", titulo: "Artículo", formato: "texto" },
          { clave: "vendedor", titulo: "Vendedor", formato: "texto" },
          { clave: "precio", titulo: "Precio", formato: "moneda" },
          { clave: "costo", titulo: "Costo", formato: "moneda" },
          { clave: "utilidad", titulo: "Utilidad", formato: "moneda" },
          { clave: "margen", titulo: "Margen", formato: "porcentaje" },
        ],
        filas,
        totales: {
          fecha: "Total",
          precio: filas.reduce((s, f) => s + f.precio, 0),
          costo,
          utilidad: venta - costo,
          margen: pct(venta - costo, venta),
        },
      },
    ],
    notas: [
      "Solo artículos individualizados (patinetas, teléfonos...): los repuestos todavía no tienen costo registrado, así que su utilidad no se puede calcular.",
      "El costo es el que tiene hoy la ficha del artículo.",
    ],
  };
}
