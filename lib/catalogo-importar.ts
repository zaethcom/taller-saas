/**
 * Leer un catálogo en Excel (repuestos, accesorios y servicios) para
 * cargarlo de una vez en la empresa -- la alternativa a crear cientos de
 * repuestos uno por uno desde /recepcion-mercancia.
 *
 * Funciones puras sobre filas ya leídas: la ruta
 * (app/api/catalogo/importar) abre el archivo con exceljs y pasa aquí
 * cada hoja como lista de objetos { encabezado: valor }. Así las reglas
 * de validación se prueban sin Excel ni base de datos.
 *
 * Hojas que se leen (las demás se ignoran, p. ej. Fuentes o Fallas):
 *   - "Repuestos" y "Accesorios" → tabla `repuesto` (mismo formato).
 *   - "Servicios" → tabla `servicio`.
 * El `codigo` es la llave: volver a importar el mismo archivo actualiza,
 * no duplica.
 */

export type Fila = Record<string, unknown>;

export interface RepuestoImportado {
  codigo: string;
  descripcion: string;
  categoria: string | null;
  precioVenta: number;
  costo: number | null;
  marca: string | null;
  modelo: string | null;
  observacion: string | null;
  enVenta: boolean;
}

export interface ServicioImportado {
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  costoEstimado: number | null;
  tiempoEstimadoMinutos: number | null;
  activo: boolean;
}

export interface Omitida {
  hoja: string;
  fila: number;
  motivo: string;
}

export interface CatalogoLeido {
  repuestos: RepuestoImportado[];
  servicios: ServicioImportado[];
  categorias: string[];
  omitidas: Omitida[];
}

export const HOJAS_REPUESTO = ["Repuestos", "Accesorios"] as const;
export const HOJA_SERVICIO = "Servicios";

/** "Precio_Venta", "precio venta" y "PRECIO VENTA" son la misma columna. */
export function normalizarEncabezado(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Números de Excel o texto como "85.000" / "$ 85.000" / "85000.5". */
export function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[$\s]/g, "");
  if (s === "") return null;
  // Formato colombiano: punto de miles, coma decimal.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** SÍ/SI/S/TRUE/1/X → true; NO/N/FALSE/0 → false; vacío → valor por defecto. */
export function booleano(v: unknown, porDefecto: boolean): boolean {
  const s = texto(v);
  if (s == null) return porDefecto;
  const n = normalizarEncabezado(s);
  if (["si", "s", "true", "1", "x", "yes", "verdadero"].includes(n)) return true;
  if (["no", "n", "false", "0", "falso"].includes(n)) return false;
  return porDefecto;
}

function campo(f: Fila, ...nombres: string[]): unknown {
  for (const n of nombres) if (n in f) return f[n];
  return undefined;
}

/**
 * La subcategoría no tiene columna propia en `repuesto` (la tabla
 * `categoria` es plana): se conserva en la observación cuando aporta
 * algo que la marca no dice ya.
 */
function observacionCon(subcategoria: string | null, marca: string | null, obs: string | null): string | null {
  const partes: string[] = [];
  if (subcategoria && subcategoria !== marca) partes.push(`Subcategoría: ${subcategoria}`);
  if (obs) partes.push(obs);
  return partes.length ? partes.join(". ") : null;
}

/**
 * `filas` ya con encabezados normalizados (normalizarEncabezado).
 * `primeraFila` es el número de fila en Excel de filas[0], para que los
 * motivos de omisión apunten a la fila real.
 */
export function leerRepuestos(hoja: string, filas: Fila[], primeraFila = 2) {
  const repuestos: RepuestoImportado[] = [];
  const omitidas: Omitida[] = [];
  filas.forEach((f, i) => {
    const fila = primeraFila + i;
    const codigo = texto(campo(f, "codigo"));
    const descripcion = texto(campo(f, "descripcion", "nombre"));
    if (!codigo && !descripcion) return; // fila vacía
    if (!codigo) return void omitidas.push({ hoja, fila, motivo: "sin código" });
    if (!descripcion) return void omitidas.push({ hoja, fila, motivo: `${codigo}: sin descripción` });
    const precio = numero(campo(f, "precio_venta", "precio"));
    if (precio == null || precio <= 0) {
      return void omitidas.push({ hoja, fila, motivo: `${codigo}: sin precio de venta` });
    }
    const marca = texto(campo(f, "marca"));
    const costo = numero(campo(f, "costo"));
    repuestos.push({
      codigo,
      descripcion,
      categoria: texto(campo(f, "categoria")),
      precioVenta: precio,
      costo: costo != null && costo > 0 ? costo : null,
      marca,
      modelo: texto(campo(f, "modelo")),
      observacion: observacionCon(texto(campo(f, "subcategoria")), marca, texto(campo(f, "observacion"))),
      enVenta: booleano(campo(f, "en_venta"), true),
    });
  });
  return { repuestos, omitidas };
}

export function leerServicios(filas: Fila[], primeraFila = 2) {
  const servicios: ServicioImportado[] = [];
  const omitidas: Omitida[] = [];
  filas.forEach((f, i) => {
    const fila = primeraFila + i;
    const nombre = texto(campo(f, "nombre", "descripcion"));
    const codigo = texto(campo(f, "codigo"));
    if (!nombre && !codigo) return;
    if (!nombre) return void omitidas.push({ hoja: HOJA_SERVICIO, fila, motivo: `${codigo}: sin nombre` });
    const precio = numero(campo(f, "precio"));
    if (precio == null || precio < 0) {
      return void omitidas.push({ hoja: HOJA_SERVICIO, fila, motivo: `${codigo ?? nombre}: sin precio` });
    }
    const costo = numero(campo(f, "costo_estimado", "costo"));
    const minutos = numero(campo(f, "tiempo_estimado_minutos", "minutos"));
    servicios.push({
      codigo,
      nombre,
      descripcion: texto(campo(f, "descripcion")) === nombre ? null : texto(campo(f, "descripcion")),
      precio,
      costoEstimado: costo != null && costo > 0 ? costo : null,
      tiempoEstimadoMinutos: minutos != null && minutos > 0 ? Math.round(minutos) : null,
      activo: booleano(campo(f, "activo"), true),
    });
  });
  return { servicios, omitidas };
}

/**
 * Junta las hojas. Un código repetido entre hojas o dentro de una hoja
 * queda con la última aparición y se reporta, porque en la base el
 * código es único por empresa.
 */
export function leerCatalogo(hojas: Record<string, { filas: Fila[]; primeraFila?: number }>): CatalogoLeido {
  const omitidas: Omitida[] = [];
  const porCodigo = new Map<string, RepuestoImportado>();
  for (const nombre of HOJAS_REPUESTO) {
    const h = hojas[nombre];
    if (!h) continue;
    const r = leerRepuestos(nombre, h.filas, h.primeraFila);
    omitidas.push(...r.omitidas);
    for (const rep of r.repuestos) {
      const clave = rep.codigo.toUpperCase();
      if (porCodigo.has(clave)) omitidas.push({ hoja: nombre, fila: 0, motivo: `${rep.codigo}: código repetido, queda la última fila` });
      porCodigo.set(clave, rep);
    }
  }

  let servicios: ServicioImportado[] = [];
  const hs = hojas[HOJA_SERVICIO];
  if (hs) {
    const r = leerServicios(hs.filas, hs.primeraFila);
    omitidas.push(...r.omitidas);
    const vistos = new Map<string, ServicioImportado>();
    const sinCodigo: ServicioImportado[] = [];
    for (const s of r.servicios) {
      if (!s.codigo) sinCodigo.push(s);
      else vistos.set(s.codigo.toUpperCase(), s);
    }
    servicios = [...vistos.values(), ...sinCodigo];
  }

  const repuestos = [...porCodigo.values()];
  const categorias = [...new Set(repuestos.map((r) => r.categoria).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  return { repuestos, servicios, categorias, omitidas };
}

/** Partir una lista en lotes, para no mandar miles de filas en un solo insert. */
export function enLotes<T>(lista: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
  return lotes;
}
