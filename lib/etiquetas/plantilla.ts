/**
 * Plantillas de etiqueta (0046_plantilla_etiqueta.sql): qué medida tiene
 * el sticker, qué código lleva y qué textos. Puro -- sin Supabase ni
 * sharp -- para que la validación y los modelos se prueben solos y los
 * use igual la API que la pantalla de /configuracion.
 */

export type UsoEtiqueta = "orden" | "articulo" | "repuesto";
export type TipoCodigo = "qr" | "barras";
export type CampoEtiqueta = "empresa" | "texto_codigo" | "descripcion" | "marco";

export interface DisenoEtiqueta {
  anchoMm: number;
  altoMm: number;
  dpi: 203 | 300;
  codigo: TipoCodigo;
  campos: CampoEtiqueta[];
  fondoUrl: string | null;
  /** Girar 180° al imprimir -- si en el papel sale al revés. No afecta la vista previa. */
  girar: boolean;
}

export interface PlantillaEtiqueta extends DisenoEtiqueta {
  id: string;
  uso: UsoEtiqueta;
  nombre: string;
  activa: boolean;
}

/** Lo que se imprime en una etiqueta, ya resuelto por quien la encola. */
export interface DatosEtiqueta {
  codigo: string;
  empresa?: string | null;
  descripcion?: string | null;
}

export const USOS: { valor: UsoEtiqueta; etiqueta: string; ayuda: string }[] = [
  { valor: "orden", etiqueta: "Equipo recibido", ayuda: "Se pega al equipo al crear la orden. El código es el de entrada (ej. PS000123)." },
  { valor: "articulo", etiqueta: "Artículo", ayuda: "Una por unidad de mercancía recibida para vender." },
  { valor: "repuesto", etiqueta: "Repuesto", ayuda: "Una por unidad de repuesto que entra al inventario." },
];

export const CAMPOS: { valor: Exclude<CampoEtiqueta, "marco">; etiqueta: string }[] = [
  { valor: "texto_codigo", etiqueta: "Código en texto" },
  { valor: "empresa", etiqueta: "Nombre de la empresa" },
  { valor: "descripcion", etiqueta: "Descripción (equipo, artículo o repuesto)" },
];

/** Datos de muestra para la vista previa y la impresión de prueba. */
export const DATOS_EJEMPLO: Record<UsoEtiqueta, DatosEtiqueta> = {
  orden: { codigo: "OR000123", empresa: "Mi Taller", descripcion: "Xiaomi Pro 2" },
  articulo: { codigo: "ART-000123", empresa: "Mi Taller", descripcion: "Xiaomi Pro 2" },
  repuesto: { codigo: "REP-0042", empresa: "Mi Taller", descripcion: "Llanta 10 pulgadas" },
};

/** La etiqueta que se imprime cuando un uso no tiene plantilla activa. */
export const ETIQUETA_DE_FABRICA: Record<UsoEtiqueta, string> = {
  orden: "QR de 30 × 25 mm con el código de entrada",
  articulo: "código de barras con el código y la marca/modelo",
  repuesto: "código de barras con la empresa y la descripción",
};

/**
 * Modelos para empezar una plantilla nueva sin escribir medidas a mano --
 * las medidas de rollo térmico más comunes. Viven en código, no en la
 * base: son un punto de partida que se copia, no algo que se edita.
 */
export const MODELOS: { id: string; nombre: string; uso: UsoEtiqueta; diseno: Omit<DisenoEtiqueta, "fondoUrl" | "girar"> }[] = [
  {
    id: "orden-30x25",
    nombre: "Equipo 30 × 25 QR (la actual)",
    uso: "orden",
    diseno: { anchoMm: 30, altoMm: 25, dpi: 203, codigo: "qr", campos: ["texto_codigo", "marco"] },
  },
  {
    id: "orden-50x30",
    nombre: "Equipo 50 × 30 QR con datos",
    uso: "orden",
    diseno: { anchoMm: 50, altoMm: 30, dpi: 203, codigo: "qr", campos: ["empresa", "texto_codigo", "descripcion", "marco"] },
  },
  {
    id: "orden-40x40",
    nombre: "Equipo 40 × 40 QR",
    uso: "orden",
    diseno: { anchoMm: 40, altoMm: 40, dpi: 203, codigo: "qr", campos: ["empresa", "texto_codigo"] },
  },
  {
    id: "articulo-50x30",
    nombre: "Artículo 50 × 30 código de barras",
    uso: "articulo",
    diseno: { anchoMm: 50, altoMm: 30, dpi: 203, codigo: "barras", campos: ["texto_codigo", "descripcion"] },
  },
  {
    id: "articulo-40x30-qr",
    nombre: "Artículo 40 × 30 QR",
    uso: "articulo",
    diseno: { anchoMm: 40, altoMm: 30, dpi: 203, codigo: "qr", campos: ["texto_codigo", "descripcion"] },
  },
  {
    id: "repuesto-50x25",
    nombre: "Repuesto 50 × 25 código de barras",
    uso: "repuesto",
    diseno: { anchoMm: 50, altoMm: 25, dpi: 203, codigo: "barras", campos: ["empresa", "texto_codigo", "descripcion"] },
  },
];

export const LIMITES = { anchoMin: 15, anchoMax: 104, altoMin: 10, altoMax: 150 } as const;

const USOS_VALIDOS = new Set<string>(USOS.map((u) => u.valor));
const CAMPOS_VALIDOS = new Set<string>(["empresa", "texto_codigo", "descripcion", "marco"]);

export type ResultadoValidacion =
  | { ok: true; valor: Omit<PlantillaEtiqueta, "id" | "activa"> }
  | { ok: false; error: string };

/** Valida una plantilla completa (al crear, o ya combinada con la fila existente al editar). */
export function validarPlantilla(entrada: Record<string, unknown>): ResultadoValidacion {
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (!nombre) return { ok: false, error: "falta el nombre de la plantilla" };
  if (nombre.length > 60) return { ok: false, error: "el nombre es muy largo (máximo 60 caracteres)" };

  const uso = entrada.uso;
  if (typeof uso !== "string" || !USOS_VALIDOS.has(uso)) {
    return { ok: false, error: "el uso debe ser orden, articulo o repuesto" };
  }

  const anchoMm = Number(entrada.anchoMm);
  const altoMm = Number(entrada.altoMm);
  if (!Number.isFinite(anchoMm) || anchoMm < LIMITES.anchoMin || anchoMm > LIMITES.anchoMax) {
    return { ok: false, error: `el ancho debe estar entre ${LIMITES.anchoMin} y ${LIMITES.anchoMax} mm` };
  }
  if (!Number.isFinite(altoMm) || altoMm < LIMITES.altoMin || altoMm > LIMITES.altoMax) {
    return { ok: false, error: `el alto debe estar entre ${LIMITES.altoMin} y ${LIMITES.altoMax} mm` };
  }

  const dpi = Number(entrada.dpi ?? 203);
  if (dpi !== 203 && dpi !== 300) return { ok: false, error: "la resolución debe ser 203 o 300 dpi" };

  const codigo = entrada.codigo;
  if (codigo !== "qr" && codigo !== "barras") return { ok: false, error: "el código debe ser qr o barras" };

  const camposEntrada = Array.isArray(entrada.campos) ? entrada.campos : [];
  if (camposEntrada.some((c) => typeof c !== "string" || !CAMPOS_VALIDOS.has(c))) {
    return { ok: false, error: "hay un campo de etiqueta desconocido" };
  }
  const campos = [...new Set(camposEntrada as CampoEtiqueta[])];

  const fondoUrl = typeof entrada.fondoUrl === "string" && entrada.fondoUrl.trim() ? entrada.fondoUrl.trim() : null;
  if (fondoUrl && !/^https:\/\//.test(fondoUrl)) return { ok: false, error: "la imagen de fondo debe ser una URL https" };

  return {
    ok: true,
    valor: {
      nombre,
      uso: uso as UsoEtiqueta,
      anchoMm: Math.round(anchoMm * 10) / 10,
      altoMm: Math.round(altoMm * 10) / 10,
      dpi,
      codigo,
      campos,
      fondoUrl,
      girar: entrada.girar === true,
    },
  };
}

/** Fila de plantilla_etiqueta (snake_case, numeric como string) -> objeto de la app. */
export interface FilaPlantilla {
  id: string;
  uso: string;
  nombre: string;
  ancho_mm: number | string;
  alto_mm: number | string;
  dpi: number;
  codigo: string;
  campos: string[] | null;
  fondo_url: string | null;
  girar: boolean;
  activa: boolean;
}

export const COLUMNAS_PLANTILLA = "id, uso, nombre, ancho_mm, alto_mm, dpi, codigo, campos, fondo_url, girar, activa";

export function filaAPlantilla(f: FilaPlantilla): PlantillaEtiqueta {
  return {
    id: f.id,
    uso: f.uso as UsoEtiqueta,
    nombre: f.nombre,
    anchoMm: Number(f.ancho_mm),
    altoMm: Number(f.alto_mm),
    dpi: f.dpi === 300 ? 300 : 203,
    codigo: f.codigo === "barras" ? "barras" : "qr",
    campos: (f.campos ?? []) as CampoEtiqueta[],
    fondoUrl: f.fondo_url,
    girar: f.girar,
    activa: f.activa,
  };
}

export function plantillaAFila(p: Omit<PlantillaEtiqueta, "id" | "activa">) {
  return {
    uso: p.uso,
    nombre: p.nombre,
    ancho_mm: p.anchoMm,
    alto_mm: p.altoMm,
    dpi: p.dpi,
    codigo: p.codigo,
    campos: p.campos,
    fondo_url: p.fondoUrl,
    girar: p.girar,
  };
}
