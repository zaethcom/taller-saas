/**
 * Fechas del servicio contratado por cada empresa (0052). Las fechas
 * viajan como texto "AAAA-MM-DD" -- igual que las devuelve Postgres para
 * una columna `date` -- y se calculan en UTC para que la zona horaria
 * del navegador o del servidor no corra un día.
 */
import type { TonoEtiqueta } from "@/componentes/ui/etiqueta";

/** Cuántos días antes del vencimiento se empieza a avisar. */
export const DIAS_AVISO = 7;

function aFecha(iso: string): Date {
  const [a = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aIso(f: Date): string {
  return f.toISOString().slice(0, 10);
}

/** Hoy en Colombia, como "AAAA-MM-DD". */
export function hoyIso(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(ahora);
}

/**
 * Suma meses a una fecha. Si el día no existe en el mes destino, queda
 * en el último día de ese mes: 31 de enero + 1 mes = 28 (o 29) de febrero.
 */
export function sumarMeses(iso: string, meses: number): string {
  const f = aFecha(iso);
  const dia = f.getUTCDate();
  const destino = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + meses, 1));
  const ultimo = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimo));
  return aIso(destino);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/**
 * Desde qué fecha cuenta un pago nuevo. Si el servicio sigue vigente,
 * el pago se suma al final (pagar antes de tiempo no hace perder días);
 * si ya venció o nunca tuvo fecha, cuenta desde hoy.
 */
export function inicioDelPago(servicioFin: string | null, hoy: string): string {
  if (servicioFin && servicioFin > hoy) return servicioFin;
  return hoy;
}

export type EstadoServicio =
  | { tipo: "sin_fecha" }
  | { tipo: "vencido"; dias: number }
  | { tipo: "por_vencer"; dias: number }
  | { tipo: "al_dia"; dias: number };

/**
 * `servicio_fin` es el día en que vence: ese día ya se avisa como
 * "vence hoy" (por vencer, 0 días); desde el día siguiente, vencido.
 */
export function estadoServicio(servicioFin: string | null, hoy: string): EstadoServicio {
  if (!servicioFin) return { tipo: "sin_fecha" };
  const dias = diasEntre(hoy, servicioFin);
  if (dias < 0) return { tipo: "vencido", dias: -dias };
  if (dias <= DIAS_AVISO) return { tipo: "por_vencer", dias };
  return { tipo: "al_dia", dias };
}

export function textoEstadoServicio(estado: EstadoServicio): string {
  switch (estado.tipo) {
    case "sin_fecha":
      return "Sin fecha";
    case "vencido":
      return estado.dias === 1 ? "Vencido hace 1 día" : `Vencido hace ${estado.dias} días`;
    case "por_vencer":
      if (estado.dias === 0) return "Vence hoy";
      return estado.dias === 1 ? "Vence mañana" : `Vence en ${estado.dias} días`;
    case "al_dia":
      return "Al día";
  }
}

export function tonoServicio(estado: EstadoServicio): TonoEtiqueta {
  if (estado.tipo === "vencido") return "peligro";
  if (estado.tipo === "por_vencer") return "aviso";
  if (estado.tipo === "al_dia") return "ok";
  return "neutro";
}

/** "2026-10-10" → "10 oct 2026". */
export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    aFecha(iso),
  );
}

export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  return aIso(aFecha(valor)) === valor;
}
