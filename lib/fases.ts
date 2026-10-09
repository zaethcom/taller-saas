/**
 * Fases de la orden: subdivisiones que cada empresa configura DENTRO de
 * un estado de lib/estados.ts (supabase/migrations/0050_fase_orden.sql).
 *
 * Regla: una fase nunca decide una transición. La máquina de estados
 * sigue siendo la de lib/estados.ts; aquí solo vive qué fase le toca a
 * una orden al entrar a un estado, si una fase le sirve a un estado, y
 * las dos plantillas que se cargan con un clic desde /configuracion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ETIQUETA_ESTADO, TRANSICIONES, type Estado } from "./estados";

export interface FaseOrden {
  id: string;
  estado: Estado;
  nombre: string;
  posicion: number;
  activo: boolean;
}

export type NombrePlantilla = "celulares" | "patinetas";

/** Las plantillas de un clic. Solo nombres y orden: el admin las ajusta después. */
export const PLANTILLAS: Record<NombrePlantilla, { etiqueta: string; fases: Partial<Record<Estado, string[]>> }> = {
  celulares: {
    etiqueta: "Celulares",
    fases: {
      en_diagnostico: ["Desarme", "Pruebas de hardware"],
      en_reparacion: ["Cambio de pantalla o batería", "Microsoldadura", "Software", "Control de calidad", "Terminado"],
    },
  },
  patinetas: {
    etiqueta: "Patinetas",
    fases: {
      en_diagnostico: ["Revisión eléctrica", "Revisión mecánica"],
      en_reparacion: ["Llantas y frenos", "Batería y controlador", "Motor", "Prueba de ruta", "Terminado"],
    },
  },
};

export function esPlantilla(valor: unknown): valor is NombrePlantilla {
  return typeof valor === "string" && valor in PLANTILLAS;
}

export function esEstado(valor: unknown): valor is Estado {
  return typeof valor === "string" && valor in TRANSICIONES;
}

/** Comparar nombres sin que "Motor " y "motor" cuenten como dos fases distintas. */
function normalizar(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es");
}

/** Las fases activas de un estado, en el orden en que se recorren. */
export function fasesActivasDe<F extends Pick<FaseOrden, "estado" | "posicion" | "activo">>(
  fases: readonly F[],
  estado: Estado,
): F[] {
  return fases.filter((f) => f.activo && f.estado === estado).sort((a, b) => a.posicion - b.posicion);
}

/** La fase con la que arranca una orden que acaba de entrar a `estado`, o null si ese estado no tiene. */
export function primeraFaseActiva<F extends Pick<FaseOrden, "estado" | "posicion" | "activo">>(
  fases: readonly F[],
  estado: Estado,
): F | null {
  return fasesActivasDe(fases, estado)[0] ?? null;
}

/** ¿Se le puede poner esta fase a una orden que está en `estado`? */
export function faseValidaPara(fase: Pick<FaseOrden, "estado" | "activo">, estado: Estado): boolean {
  return fase.activo && fase.estado === estado;
}

/** La posición para una fase nueva al final de su estado. */
export function siguientePosicion(fases: readonly Pick<FaseOrden, "estado" | "posicion">[], estado: Estado): number {
  const enEstado = fases.filter((f) => f.estado === estado);
  return enEstado.length === 0 ? 0 : Math.max(...enEstado.map((f) => f.posicion)) + 1;
}

/**
 * Las filas que hay que insertar para cargar una plantilla: van después
 * de las que ya existen en cada estado, y se salta un nombre que ya
 * existe activo en ese mismo estado -- cargar dos veces la misma
 * plantilla no duplica nada.
 */
export function filasDePlantilla(
  plantilla: NombrePlantilla,
  existentes: readonly Pick<FaseOrden, "estado" | "nombre" | "posicion" | "activo">[],
): { estado: Estado; nombre: string; posicion: number }[] {
  const filas: { estado: Estado; nombre: string; posicion: number }[] = [];
  for (const [estado, nombres] of Object.entries(PLANTILLAS[plantilla].fases) as [Estado, string[]][]) {
    const activos = new Set(existentes.filter((f) => f.activo && f.estado === estado).map((f) => normalizar(f.nombre)));
    let posicion = siguientePosicion(existentes, estado);
    for (const nombre of nombres) {
      if (activos.has(normalizar(nombre))) continue;
      activos.add(normalizar(nombre));
      filas.push({ estado, nombre, posicion: posicion++ });
    }
  }
  return filas;
}

/**
 * Mover una fase un lugar arriba o abajo dentro de su estado. Devuelve
 * las posiciones nuevas de todo el estado renumeradas 0..n-1 (solo las
 * que cambiaron), en vez de intercambiar dos números: dos fases con la
 * misma posición no se podrían separar de otra forma.
 */
export function moverFase(
  fases: readonly Pick<FaseOrden, "id" | "estado" | "posicion">[],
  id: string,
  direccion: "arriba" | "abajo",
): { id: string; posicion: number }[] {
  const fase = fases.find((f) => f.id === id);
  if (!fase) return [];
  const lista = fases.filter((f) => f.estado === fase.estado).sort((a, b) => a.posicion - b.posicion);
  const i = lista.findIndex((f) => f.id === id);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (j < 0 || j >= lista.length) return [];
  const reordenada = lista.slice();
  reordenada.splice(j, 0, ...reordenada.splice(i, 1));
  return reordenada
    .map((f, posicion) => ({ id: f.id, posicion, antes: f.posicion }))
    .filter((f) => f.posicion !== f.antes)
    .map(({ id, posicion }) => ({ id, posicion }));
}

/**
 * Cómo se lee una fila de orden_evento en un historial: un cambio de
 * estado muestra el estado (y la fase con que arrancó, si hay); un
 * cambio de fase dentro del mismo estado muestra solo la fase.
 */
export function etiquetaEvento(e: { de_estado: string | null; a_estado: string; a_fase: string | null }): string {
  const estado = ETIQUETA_ESTADO[e.a_estado as Estado] ?? e.a_estado;
  if (e.de_estado === e.a_estado) {
    return e.a_fase ? `${estado} · ${e.a_fase}` : `${estado} · sin fase`;
  }
  return e.a_fase ? `${estado} · ${e.a_fase}` : estado;
}

/**
 * La primera fase activa de un estado para una empresa, consultando la
 * base. Recibe empresaId explícito porque /api/aprobacion usa el
 * cliente con service role, donde RLS no filtra por empresa.
 */
export async function buscarPrimeraFase(
  supabase: SupabaseClient,
  empresaId: string,
  estado: Estado,
): Promise<{ id: string; nombre: string } | null> {
  const { data } = await supabase
    .from("fase_orden")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("estado", estado)
    .eq("activo", true)
    .order("posicion", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
