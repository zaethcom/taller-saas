/**
 * Qué informes hay, cómo se agrupan en la pantalla y qué filtros usa
 * cada uno. Sin dependencias de servidor: lo leen la página, la ruta de
 * exportación y las pruebas.
 */

export type IdInforme =
  | "ventas-fecha"
  | "ventas-vendedor"
  | "ventas-producto"
  | "ventas-categoria"
  | "ventas-metodo-pago"
  | "ventas-sede"
  | "ventas-hora"
  | "ventas-tipo"
  | "ventas-detalle"
  | "cierres-caja"
  | "inventario-repuestos"
  | "articulos-stock"
  | "kardex"
  | "ordenes-taller"
  | "productividad-tecnicos"
  | "utilidad-articulos"
  | "metricas-piloto";

export interface DefInforme {
  id: IdInforme;
  nombre: string;
  descripcion: string;
  grupo: "Ventas" | "Caja" | "Inventario" | "Taller";
  /** false: es una foto a hoy (inventario) o no depende de fechas. */
  usaFechas: boolean;
  usaSede: boolean;
}

export const INFORMES: DefInforme[] = [
  { id: "ventas-fecha", nombre: "Ventas por fecha", descripcion: "Total vendido por día, semana o mes.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-vendedor", nombre: "Ventas por vendedor", descripcion: "Cuánto vendió cada usuario.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-producto", nombre: "Ventas por producto", descripcion: "Los productos más vendidos, en unidades y valor.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-categoria", nombre: "Ventas por categoría", descripcion: "Lo vendido agrupado por categoría.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-metodo-pago", nombre: "Ventas por método de pago", descripcion: "Efectivo, transferencia, tarjeta...", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-sede", nombre: "Ventas por sede", descripcion: "Comparativo entre sedes.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-hora", nombre: "Horas y días pico", descripcion: "A qué hora y qué día se vende más.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-tipo", nombre: "Mostrador vs. servicio", descripcion: "Venta directa frente a cobro de órdenes.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "ventas-detalle", nombre: "Detalle de ventas", descripcion: "Cada venta, una por fila.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "utilidad-articulos", nombre: "Utilidad de artículos", descripcion: "Precio menos costo de los artículos vendidos.", grupo: "Ventas", usaFechas: true, usaSede: true },
  { id: "cierres-caja", nombre: "Cierres de caja", descripcion: "Turnos, efectivo esperado contra contado y descuadres.", grupo: "Caja", usaFechas: true, usaSede: true },
  { id: "inventario-repuestos", nombre: "Inventario de repuestos", descripcion: "Existencias por sede, valorizadas, con lo que hay que reponer.", grupo: "Inventario", usaFechas: false, usaSede: true },
  { id: "articulos-stock", nombre: "Artículos en stock", descripcion: "Artículos individualizados disponibles, con costo y margen.", grupo: "Inventario", usaFechas: false, usaSede: true },
  { id: "kardex", nombre: "Movimientos de inventario", descripcion: "Entradas, salidas, ajustes y traslados (kardex).", grupo: "Inventario", usaFechas: true, usaSede: true },
  { id: "ordenes-taller", nombre: "Órdenes del taller", descripcion: "Órdenes por estado y tiempos de reparación.", grupo: "Taller", usaFechas: true, usaSede: true },
  { id: "productividad-tecnicos", nombre: "Productividad por técnico", descripcion: "Equipos asignados, terminados y tiempo promedio.", grupo: "Taller", usaFechas: true, usaSede: true },
  { id: "metricas-piloto", nombre: "Métricas del piloto", descripcion: "Las métricas de éxito del piloto (Fase 8).", grupo: "Taller", usaFechas: false, usaSede: false },
];

export const GRUPOS: DefInforme["grupo"][] = ["Ventas", "Caja", "Inventario", "Taller"];

export function buscarInforme(id: string | undefined | null): DefInforme {
  return INFORMES.find((i) => i.id === id) ?? INFORMES[0]!;
}
