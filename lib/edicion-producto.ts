/**
 * Validación de lo que llega al editar un producto desde /inventario:
 * PATCH /api/repuestos/[id] y PATCH /api/inventario/articulos/[id].
 * Convierte el cuerpo (camelCase, valores del formulario) en las
 * columnas a actualizar, o devuelve el primer error en palabras para
 * mostrarle al usuario. Un campo que no viene en el cuerpo no se toca;
 * uno que viene vacío se borra (si la columna lo permite).
 */

export const CONDICIONES_ARTICULO = [
  { valor: "nuevo_original", etiqueta: "Nuevo / Original" },
  { valor: "nuevo_generico", etiqueta: "Nuevo / Genérico" },
  { valor: "usado_segunda", etiqueta: "Segunda mano / Usado" },
  { valor: "desmontado_recuperado", etiqueta: "Desmontado / Recuperado" },
] as const;

type Resultado = { cambios: Record<string, string | number | boolean | null> } | { error: string };

function texto(valor: unknown): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

function monto(valor: unknown, nombre: string): number | null | undefined | { error: string } {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return { error: `${nombre} debe ser un número mayor o igual a cero` };
  return Math.round(n * 100) / 100;
}

export interface CuerpoRepuesto {
  imagenUrl?: string;
  enVenta?: boolean;
  codigo?: string;
  descripcion?: string;
  precioVenta?: number | string | null;
  costo?: number | string | null;
  marca?: string | null;
  modelo?: string | null;
  categoriaId?: string | null;
  observacion?: string | null;
}

export function cambiosRepuesto(body: CuerpoRepuesto): Resultado {
  const cambios: Record<string, string | number | boolean | null> = {};

  if (body.imagenUrl) cambios.imagen_url = body.imagenUrl;
  if (typeof body.enVenta === "boolean") cambios.en_venta = body.enVenta;

  const codigo = texto(body.codigo);
  if (codigo === null) return { error: "El código no puede quedar vacío" };
  if (codigo !== undefined) {
    // Va impreso en un código de barras (Code 128): solo ASCII visible.
    if (!/^[\x21-\x7E]+$/.test(codigo)) {
      return { error: "El código solo puede tener letras sin tilde, números y signos, sin espacios" };
    }
    cambios.codigo = codigo;
  }

  const descripcion = texto(body.descripcion);
  if (descripcion === null) return { error: "La descripción no puede quedar vacía" };
  if (descripcion !== undefined) cambios.descripcion = descripcion;

  const precio = monto(body.precioVenta, "El precio de venta");
  if (precio && typeof precio === "object") return precio;
  // precio_venta es not null: vacío se guarda como 0.
  if (precio !== undefined) cambios.precio_venta = precio ?? 0;

  const costo = monto(body.costo, "El costo");
  if (costo && typeof costo === "object") return costo;
  if (costo !== undefined) cambios.costo = costo;

  for (const [campo, columna] of [
    ["marca", "marca"],
    ["modelo", "modelo"],
    ["categoriaId", "categoria_id"],
    ["observacion", "observacion"],
  ] as const) {
    const v = texto(body[campo]);
    if (v !== undefined) cambios[columna] = v;
  }

  if (Object.keys(cambios).length === 0) return { error: "No hay nada que guardar" };
  return { cambios };
}

export interface CuerpoArticulo {
  imagenUrl?: string;
  tipo?: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  costo?: number | string | null;
  precioVenta?: number | string | null;
  condicion?: string | null;
  categoriaId?: string | null;
}

export function cambiosArticulo(body: CuerpoArticulo): Resultado {
  const cambios: Record<string, string | number | boolean | null> = {};

  if (body.imagenUrl) cambios.imagen_url = body.imagenUrl;

  const tipo = texto(body.tipo);
  if (tipo === null) return { error: "El tipo no puede quedar vacío" };
  if (tipo !== undefined) cambios.tipo = tipo;

  for (const [campo, columna] of [
    ["marca", "marca"],
    ["modelo", "modelo"],
    ["numeroSerie", "numero_serie"],
    ["categoriaId", "categoria_id"],
  ] as const) {
    const v = texto(body[campo]);
    if (v !== undefined) cambios[columna] = v;
  }

  // costo y precio_venta son not null en articulo: vacío es 0.
  for (const [campo, columna, nombre] of [
    ["costo", "costo", "El costo"],
    ["precioVenta", "precio_venta", "El precio de venta"],
  ] as const) {
    const v = monto(body[campo], nombre);
    if (v && typeof v === "object") return v;
    if (v !== undefined) cambios[columna] = v ?? 0;
  }

  const condicion = texto(body.condicion);
  if (condicion !== undefined) {
    if (condicion !== null && !CONDICIONES_ARTICULO.some((c) => c.valor === condicion)) {
      return { error: "Condición no válida" };
    }
    cambios.condicion = condicion;
  }

  if (Object.keys(cambios).length === 0) return { error: "No hay nada que guardar" };
  return { cambios };
}
