/**
 * Fecha y hora para imprimir en un recibo: «22/10/2026 7:39 p. m.», en hora
 * de Colombia. El servidor (Vercel) corre en UTC: sin la zona horaria, de
 * noche salía la hora y hasta el día equivocados.
 *
 * Los espacios raros que pone Intl antes de «p. m.» (U+202F, U+00A0) se
 * cambian por espacios normales: la impresora solo imprime ASCII y los
 * convertiría en guiones.
 */
export function fechaHoraRecibo(fecha: Date | string): string {
  return new Date(fecha)
    .toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .replace(/[  ]/g, " ")
    .replace(",", "");
}
