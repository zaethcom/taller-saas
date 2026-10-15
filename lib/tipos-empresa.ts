/**
 * Tipos de empresa (supabase/migrations/0053_tipo_empresa.sql): los
 * estándares que el superadmin define una vez -- celulares,
 * computadores, patinetas... -- y le asigna a cada empresa.
 *
 * Asignar un tipo copia a la empresa su tipo de equipo por defecto,
 * sus fases de la orden y sus categorías iniciales. Solo agrega: nunca
 * borra ni renombra lo que la empresa ya tiene, y aplicarlo dos veces no
 * duplica nada (filasDeFases se salta las fases que ya existen activas;
 * las categorías repetidas se ignoran por su unique).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Estado } from "./estados";
import type { TipoNegocio } from "./configuracion";
import { esEstado, filasDeFases, type FaseOrden } from "./fases";

export interface TipoEmpresa {
  id: string;
  nombre: string;
  tipo_equipo: TipoNegocio;
  fases: Partial<Record<Estado, string[]>>;
  categorias: string[];
  activo: boolean;
}

export const TIPOS_EQUIPO: { valor: TipoNegocio; etiqueta: string }[] = [
  { valor: "celular", etiqueta: "Celular" },
  { valor: "computador", etiqueta: "Computador" },
  { valor: "patineta", etiqueta: "Patineta" },
  { valor: "otro", etiqueta: "Otro" },
];

export function esTipoEquipo(valor: unknown): valor is TipoNegocio {
  return TIPOS_EQUIPO.some((t) => t.valor === valor);
}

/** Lista de nombres sin vacíos ni repetidos (sin importar mayúsculas), en el orden dado. */
export function limpiarNombres(nombres: readonly unknown[]): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const n of nombres) {
    if (typeof n !== "string") continue;
    const nombre = n.trim().replace(/\s+/g, " ");
    const clave = nombre.toLocaleLowerCase("es");
    if (!nombre || vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push(nombre);
  }
  return salida;
}

/** Texto con un nombre por línea (lo que se escribe en el formulario) → lista limpia. */
export function lineas(texto: string): string[] {
  return limpiarNombres(texto.split("\n"));
}

/**
 * Valida y limpia lo que llega en el body para crear o editar un tipo.
 * Devuelve un mensaje de error, o los campos listos para guardar (solo
 * los que vinieron).
 */
export function validarTipo(
  body: Record<string, unknown>,
  { parcial }: { parcial: boolean },
): { error: string } | { campos: Partial<Omit<TipoEmpresa, "id">> } {
  const campos: Partial<Omit<TipoEmpresa, "id">> = {};

  if (body.nombre !== undefined || !parcial) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) return { error: "falta el nombre del tipo" };
    campos.nombre = body.nombre.trim();
  }
  if (body.tipo_equipo !== undefined) {
    if (!esTipoEquipo(body.tipo_equipo)) return { error: "el tipo de equipo no es válido" };
    campos.tipo_equipo = body.tipo_equipo;
  }
  if (body.fases !== undefined) {
    if (typeof body.fases !== "object" || body.fases === null || Array.isArray(body.fases)) {
      return { error: "las fases no son válidas" };
    }
    const fases: Partial<Record<Estado, string[]>> = {};
    for (const [estado, nombres] of Object.entries(body.fases)) {
      if (!esEstado(estado) || !Array.isArray(nombres)) return { error: "las fases no son válidas" };
      const limpios = limpiarNombres(nombres);
      if (limpios.length > 0) fases[estado] = limpios;
    }
    campos.fases = fases;
  }
  if (body.categorias !== undefined) {
    if (!Array.isArray(body.categorias)) return { error: "las categorías no son válidas" };
    campos.categorias = limpiarNombres(body.categorias);
  }
  if (body.activo !== undefined) {
    if (typeof body.activo !== "boolean") return { error: "el estado activo no es válido" };
    campos.activo = body.activo;
  }
  return { campos };
}

/**
 * Le asigna un tipo a una empresa y le copia lo que el tipo trae.
 * Recibe el cliente con service role (el superadmin no pertenece a la
 * empresa, así que RLS no lo dejaría escribir) y por eso filtra por
 * empresa_id explícito en cada consulta.
 */
export async function aplicarTipoEmpresa(
  admin: SupabaseClient,
  empresaId: string,
  tipo: Pick<TipoEmpresa, "id" | "tipo_equipo" | "fases" | "categorias">,
): Promise<{ fases: number; categorias: number }> {
  const { error: errEmpresa } = await admin.from("empresa").update({ tipo_empresa_id: tipo.id }).eq("id", empresaId);
  if (errEmpresa) throw new Error(errEmpresa.message);

  const { error: errConfig } = await admin
    .from("empresa_config")
    .upsert(
      { empresa_id: empresaId, tipo_negocio: tipo.tipo_equipo, actualizado_en: new Date().toISOString() },
      { onConflict: "empresa_id" },
    );
  if (errConfig) throw new Error(errConfig.message);

  const { data: existentes, error: errFases } = await admin
    .from("fase_orden")
    .select("estado, nombre, posicion, activo")
    .eq("empresa_id", empresaId);
  if (errFases) throw new Error(errFases.message);

  const filas = filasDeFases(tipo.fases ?? {}, (existentes ?? []) as FaseOrden[]);
  if (filas.length > 0) {
    const { error } = await admin.from("fase_orden").insert(filas.map((f) => ({ ...f, empresa_id: empresaId })));
    if (error) throw new Error(error.message);
  }

  let categorias = 0;
  const nombres = limpiarNombres(tipo.categorias ?? []);
  if (nombres.length > 0) {
    const { data: actuales, error: errCat } = await admin
      .from("categoria")
      .select("nombre")
      .eq("empresa_id", empresaId);
    if (errCat) throw new Error(errCat.message);
    const ya = new Set((actuales ?? []).map((c: { nombre: string }) => c.nombre.trim().toLocaleLowerCase("es")));
    const nuevas = nombres.filter((n) => !ya.has(n.toLocaleLowerCase("es")));
    if (nuevas.length > 0) {
      const { error } = await admin
        .from("categoria")
        .insert(nuevas.map((nombre) => ({ empresa_id: empresaId, nombre })));
      if (error) throw new Error(error.message);
    }
    categorias = nuevas.length;
  }

  return { fases: filas.length, categorias };
}
