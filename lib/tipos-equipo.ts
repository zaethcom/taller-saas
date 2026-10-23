/**
 * Tipos de equipo que ofrece Recibir equipo (Patineta, Celular,
 * Computador...). Cada empresa los edita en Configuración → Taller y
 * quedan en empresa_config.tipos_equipo (0068_tipos_equipo.sql); sin
 * nada guardado se usan los de siempre.
 *
 * Cada tipo tiene un `valor` (lo que se guarda en producto.tipo) y una
 * `etiqueta` (lo que se ve). Renombrar cambia solo la etiqueta: las
 * órdenes viejas y la lógica que mira el valor -- "celular" pide
 * teléfono alterno -- siguen igual. Quitar un tipo solo lo saca de la
 * lista; los equipos que ya lo tienen lo conservan.
 */

export interface TipoEquipo {
  valor: string;
  etiqueta: string;
}

export const TIPOS_EQUIPO_POR_DEFECTO: TipoEquipo[] = [
  { valor: "patineta", etiqueta: "Patineta" },
  { valor: "celular", etiqueta: "Celular" },
  { valor: "computador", etiqueta: "Computador" },
];

export const MAX_TIPOS_EQUIPO = 30;
export const MAX_LARGO_ETIQUETA = 40;

/** "Tablet / iPad" → "tablet-ipad": sin tildes, minúsculas, guiones. */
export function valorDeEtiqueta(etiqueta: string): string {
  return etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function limpiarEtiqueta(texto: string): string {
  return texto.trim().replace(/\s+/g, " ");
}

/**
 * Lo guardado en la base (o lo que llega en el body) → lista válida.
 * Los que no traen valor reciben uno a partir de la etiqueta, sin
 * chocar con los demás; se descartan vacíos y etiquetas repetidas.
 * Devuelve null si no hay ningún tipo usable.
 */
export function normalizarTiposEquipo(datos: unknown): TipoEquipo[] | null {
  if (!Array.isArray(datos)) return null;
  const salida: TipoEquipo[] = [];
  const valores = new Set<string>();
  const etiquetas = new Set<string>();
  for (const d of datos) {
    if (!d || typeof d !== "object") continue;
    const { valor, etiqueta } = d as { valor?: unknown; etiqueta?: unknown };
    if (typeof etiqueta !== "string") continue;
    const nombre = limpiarEtiqueta(etiqueta).slice(0, MAX_LARGO_ETIQUETA);
    const clave = nombre.toLocaleLowerCase("es");
    if (!nombre || etiquetas.has(clave)) continue;

    let v = typeof valor === "string" && valor.trim() ? valor.trim() : valorDeEtiqueta(nombre) || "tipo";
    if (valores.has(v)) {
      let n = 2;
      while (valores.has(`${v}-${n}`)) n++;
      v = `${v}-${n}`;
    }
    valores.add(v);
    etiquetas.add(clave);
    salida.push({ valor: v, etiqueta: nombre });
    if (salida.length >= MAX_TIPOS_EQUIPO) break;
  }
  return salida.length > 0 ? salida : null;
}

/** La lista de la empresa, o la de siempre si no ha guardado ninguna. */
export function tiposEquipoDeEmpresa(guardado: unknown): TipoEquipo[] {
  return normalizarTiposEquipo(guardado) ?? TIPOS_EQUIPO_POR_DEFECTO;
}

/**
 * Las opciones de un selector: la lista de la empresa más el tipo que
 * ya tiene el equipo si no está en ella (uno quitado o uno viejo), para
 * no cambiárselo sin querer.
 */
export function opcionesTipoEquipo(lista: TipoEquipo[], actual?: string | null): TipoEquipo[] {
  if (!actual || lista.some((t) => t.valor === actual)) return lista;
  return [{ valor: actual, etiqueta: etiquetaTipoEquipo(actual, []) }, ...lista];
}

/** Cómo se muestra un producto.tipo: la etiqueta de la empresa, o el valor con mayúscula inicial. */
export function etiquetaTipoEquipo(valor: string, lista: TipoEquipo[]): string {
  const tipo = lista.find((t) => t.valor === valor) ?? TIPOS_EQUIPO_POR_DEFECTO.find((t) => t.valor === valor);
  if (tipo) return tipo.etiqueta;
  return valor ? valor.charAt(0).toUpperCase() + valor.slice(1) : valor;
}

/** El tipo que Recibir propone primero: el del negocio si sigue en la lista, si no el primero. */
export function tipoEquipoInicial(lista: TipoEquipo[], preferido: string | null): string {
  if (preferido && lista.some((t) => t.valor === preferido)) return preferido;
  return lista[0]?.valor ?? "patineta";
}
