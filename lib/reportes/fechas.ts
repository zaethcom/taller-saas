/**
 * Fechas de los informes en hora de Colombia. La base guarda todo en
 * UTC; una venta de las 8 p. m. del lunes en Bogotá es martes en UTC, y
 * agrupar por día en UTC la pasaría al día siguiente. Colombia no tiene
 * horario de verano, así que el desfase es fijo: -05:00.
 */

const DESFASE_MS = -5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** "2026-10-07" válido, o null. */
export function fechaValida(texto: string | undefined | null): string | null {
  if (!texto || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto ? null : texto;
}

/** El día de hoy en Colombia, "AAAA-MM-DD". */
export function hoyLocal(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() + DESFASE_MS).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + dias * DIA_MS).toISOString().slice(0, 10);
}

/**
 * Límites en UTC para consultar [desde 00:00, hasta 23:59:59.999] hora
 * de Colombia: el fin se da como el inicio del día siguiente (exclusivo).
 */
export function limitesUtc(desde: string, hasta: string): { inicio: string; fin: string } {
  const inicio = new Date(new Date(`${desde}T00:00:00Z`).getTime() - DESFASE_MS).toISOString();
  const fin = new Date(new Date(`${sumarDias(hasta, 1)}T00:00:00Z`).getTime() - DESFASE_MS).toISOString();
  return { inicio, fin };
}

/** Un instante de la base, visto como fecha/hora local de Colombia. */
function local(iso: string): Date {
  return new Date(new Date(iso).getTime() + DESFASE_MS);
}

export function diaLocal(iso: string): string {
  return local(iso).toISOString().slice(0, 10);
}

export function horaLocal(iso: string): number {
  return local(iso).getUTCHours();
}

/** 0 = lunes ... 6 = domingo. */
export function diaSemanaLocal(iso: string): number {
  return (local(iso).getUTCDay() + 6) % 7;
}

/** El lunes de la semana de una fecha "AAAA-MM-DD". */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return sumarDias(fecha, -((d.getUTCDay() + 6) % 7));
}

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function nombreMes(clave: string): string {
  const [anio, mes] = clave.split("-");
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / DIA_MS) + 1;
}

/** Rangos rápidos para los botones de la pantalla. */
export function rangosRapidos(hoy: string): { etiqueta: string; desde: string; hasta: string }[] {
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const finMesAnterior = sumarDias(inicioMes, -1);
  return [
    { etiqueta: "Hoy", desde: hoy, hasta: hoy },
    { etiqueta: "Ayer", desde: sumarDias(hoy, -1), hasta: sumarDias(hoy, -1) },
    { etiqueta: "Últimos 7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { etiqueta: "Este mes", desde: inicioMes, hasta: hoy },
    { etiqueta: "Mes anterior", desde: `${finMesAnterior.slice(0, 7)}-01`, hasta: finMesAnterior },
    { etiqueta: "Este año", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy },
  ];
}
