/**
 * Cómo se lee cada valor de un informe, igual en pantalla y en PDF. El
 * Excel no usa esto: guarda el número crudo con formato de celda, para
 * que se pueda sumar y filtrar.
 */
import type { Formato, Valor } from "./tipos";

const MONEDA = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const NUMERO = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/** Desfase fijo de Colombia; ver lib/reportes/fechas.ts. */
function local(iso: string): Date {
  return new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
}

function dos(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

export function formatear(valor: Valor, formato: Formato): string {
  if (valor === null || valor === "") return "—";
  if (typeof valor === "string" && formato !== "fecha" && formato !== "fechaHora") return valor;
  // Un texto en una columna de fecha ("Abierto") se muestra tal cual.
  if ((formato === "fecha" || formato === "fechaHora") && Number.isNaN(new Date(String(valor)).getTime())) return String(valor);

  switch (formato) {
    case "moneda":
      return MONEDA.format(Number(valor));
    case "numero":
      return NUMERO.format(Number(valor));
    case "porcentaje":
      return `${NUMERO.format(Number(valor))}%`;
    case "horas":
      return fmtHoras(Number(valor));
    case "fecha": {
      const s = String(valor);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
      const d = local(s);
      return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    }
    case "fechaHora": {
      const d = local(String(valor));
      return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
    }
    default:
      return String(valor);
  }
}
