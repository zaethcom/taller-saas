/**
 * Cálculos del turno de caja: cuánto efectivo debería haber y cuánto
 * sobró o faltó al cerrar. La lógica vive aquí, no repetida entre la
 * pantalla de cierre y cualquier reporte que la necesite después.
 */

export interface ResumenTurno {
  baseInicial: number;
  ventasEfectivo: number;
  /** Dinero metido a la caja sin venta (0054_movimiento_caja.sql). */
  ingresosEfectivo: number;
  /** Dinero sacado de la caja sin venta: pagos, retiros. */
  salidasEfectivo: number;
}

export function efectivoEsperado(resumen: ResumenTurno): number {
  return resumen.baseInicial + resumen.ventasEfectivo + resumen.ingresosEfectivo - resumen.salidasEfectivo;
}

export type TipoMovimientoCaja = "ingreso" | "salida";

export interface MovimientoCaja {
  tipo: TipoMovimientoCaja;
  monto: number;
}

/** Cuánto entró y cuánto salió de la caja en los movimientos de un turno. */
export function totalesMovimientos(movimientos: MovimientoCaja[]): { ingresos: number; salidas: number } {
  let ingresos = 0;
  let salidas = 0;
  for (const m of movimientos) {
    if (m.tipo === "ingreso") ingresos += Number(m.monto);
    else salidas += Number(m.monto);
  }
  return { ingresos, salidas };
}

export function calcularDiferencia(resumen: ResumenTurno, efectivoContado: number): number {
  return efectivoContado - efectivoEsperado(resumen);
}

/**
 * El saldo pendiente de una orden: lo cotizado menos lo ya pagado
 * (anticipo + abonos). Es lo que exige la Fase de entrega antes de
 * dejar pasar el requisito `saldo_en_cero` de lib/estados.ts.
 */
export function saldoPendiente(totalCotizado: number, totalPagado: number): number {
  return Math.max(0, totalCotizado - totalPagado);
}

export function saldoEnCero(totalCotizado: number, totalPagado: number): boolean {
  return saldoPendiente(totalCotizado, totalPagado) === 0;
}
