/**
 * Cálculos del turno de caja: cuánto efectivo debería haber y cuánto
 * sobró o faltó al cerrar. La lógica vive aquí, no repetida entre la
 * pantalla de cierre y cualquier reporte que la necesite después.
 */

export interface ResumenTurno {
  baseInicial: number;
  ventasEfectivo: number;
  aperturasManualesEfectivo: number;
}

export function efectivoEsperado(resumen: ResumenTurno): number {
  return resumen.baseInicial + resumen.ventasEfectivo;
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
