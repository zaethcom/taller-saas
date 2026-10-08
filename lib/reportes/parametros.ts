/**
 * Leer y validar los filtros de la URL (?informe=&desde=&hasta=&sede=&agrupar=).
 * La pantalla y la exportación leen lo mismo, así que el Excel o el PDF
 * siempre salen con los filtros que el admin tiene en pantalla.
 */
import { buscarInforme, type DefInforme } from "./catalogo";
import { fechaValida, hoyLocal } from "./fechas";
import type { Filtro } from "./generar";
import type { Agrupacion } from "./informes";

export interface Parametros {
  def: DefInforme;
  filtro: Filtro;
  /** Nombre legible de la sede filtrada, o "Todas las sedes". */
  sedeNombre: string;
}

type Entrada = Record<string, string | string[] | undefined> | URLSearchParams;

function leer(p: Entrada, clave: string): string | undefined {
  if (p instanceof URLSearchParams) return p.get(clave) ?? undefined;
  const v = p[clave];
  return Array.isArray(v) ? v[0] : v;
}

export function leerParametros(p: Entrada, sedes: { id: string; nombre: string }[], ahora: Date = new Date()): Parametros {
  const def = buscarInforme(leer(p, "informe"));
  const hoy = hoyLocal(ahora);
  let desde = fechaValida(leer(p, "desde")) ?? `${hoy.slice(0, 7)}-01`;
  let hasta = fechaValida(leer(p, "hasta")) ?? hoy;
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  // Solo una sede que el usuario puede ver; cualquier otra cosa = todas.
  const pedida = leer(p, "sede");
  const sede = sedes.find((s) => s.id === pedida) ?? null;

  const agrupar = leer(p, "agrupar");
  return {
    def,
    filtro: {
      desde,
      hasta,
      sedeId: sede?.id ?? null,
      agrupar: agrupar === "semana" || agrupar === "mes" ? (agrupar as Agrupacion) : "dia",
    },
    sedeNombre: sede?.nombre ?? "Todas las sedes",
  };
}

/** La query string de unos filtros, para enlaces y exportación. */
export function aQuery(def: DefInforme, f: Filtro, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ informe: def.id, desde: f.desde, hasta: f.hasta, agrupar: f.agrupar, ...extra });
  if (f.sedeId) q.set("sede", f.sedeId);
  return q.toString();
}
