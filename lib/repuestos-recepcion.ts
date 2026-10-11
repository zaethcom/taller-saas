/**
 * Repuestos que quien recibe identifica desde el mostrador: el daño ya
 * se sabe ("pantalla rota") y el repuesto que lleva también. Lo que no
 * alcanza en la sede pasa de una vez a la lista de Compras
 * (repuesto_solicitud), vinculado a la orden -- Compras ve desde el
 * primer minuto qué hace falta, sin esperar a que el equipo llegue a
 * reparación. Comprarlo sigue dependiendo de que el cliente apruebe
 * (Compras lo marca, ver app/(admin)/compras).
 *
 * Lo que sí hay en la sede no se descuenta aquí: se consume en la
 * orden cuando el técnico lo usa, como cualquier repuesto.
 */

export interface RepuestoRecepcion {
  /** Del catálogo; sin él es un repuesto que la empresa todavía no maneja. */
  repuestoId?: string;
  descripcion: string;
  cantidad: number;
}

export interface FaltanteRecepcion {
  repuestoId?: string;
  descripcion: string;
  /** Lo que hay que comprar: lo pedido menos lo que ya hay en la sede. */
  cantidad: number;
}

export interface ClasificacionRepuestos {
  faltantes: FaltanteRecepcion[];
  disponibles: RepuestoRecepcion[];
}

/** Limpia lo que llega del formulario: sin descripción o sin cantidad no es un repuesto. */
export function normalizarRepuestos(lineas: unknown): RepuestoRecepcion[] {
  if (!Array.isArray(lineas)) return [];
  return lineas.flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const { repuestoId, descripcion, cantidad } = l as Record<string, unknown>;
    const texto = typeof descripcion === "string" ? descripcion.trim() : "";
    const n = Math.floor(Number(cantidad) || 0);
    if (!texto || n <= 0) return [];
    return [{ repuestoId: typeof repuestoId === "string" && repuestoId ? repuestoId : undefined, descripcion: texto, cantidad: n }];
  });
}

/**
 * Separa lo que alcanza en la sede de lo que hay que comprar.
 * `existencias` es repuestoId → cantidad en la sede de la orden. El
 * mismo repuesto pedido en dos líneas se suma antes de compararlo.
 */
export function clasificarRepuestos(
  lineas: RepuestoRecepcion[],
  existencias: ReadonlyMap<string, number>,
): ClasificacionRepuestos {
  const faltantes: FaltanteRecepcion[] = [];
  const disponibles: RepuestoRecepcion[] = [];
  const usado = new Map<string, number>();

  for (const linea of lineas) {
    if (!linea.repuestoId) {
      faltantes.push({ descripcion: linea.descripcion, cantidad: linea.cantidad });
      continue;
    }
    const yaUsado = usado.get(linea.repuestoId) ?? 0;
    const hay = Math.max(0, (existencias.get(linea.repuestoId) ?? 0) - yaUsado);
    const alcanza = Math.min(hay, linea.cantidad);
    usado.set(linea.repuestoId, yaUsado + alcanza);

    if (alcanza > 0) disponibles.push({ ...linea, cantidad: alcanza });
    if (linea.cantidad > alcanza) {
      faltantes.push({ repuestoId: linea.repuestoId, descripcion: linea.descripcion, cantidad: linea.cantidad - alcanza });
    }
  }

  return { faltantes, disponibles };
}

/** Lo que queda en el historial de la orden, en una línea. */
export function notaRepuestosRecepcion({ faltantes, disponibles }: ClasificacionRepuestos): string | null {
  const lista = (xs: { descripcion: string; cantidad: number }[]) =>
    xs.map((x) => (x.cantidad > 1 ? `${x.descripcion} ×${x.cantidad}` : x.descripcion)).join(", ");
  const partes: string[] = [];
  if (faltantes.length) partes.push(`Sin existencia, pasa a Compras: ${lista(faltantes)}`);
  if (disponibles.length) partes.push(`Disponible en la sede: ${lista(disponibles)}`);
  return partes.length ? `Repuestos identificados al recibir. ${partes.join(". ")}.` : null;
}
