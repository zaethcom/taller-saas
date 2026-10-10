/**
 * Marcas y modelos que se ofrecen al recibir un equipo (/recibir).
 *
 * No hay tabla propia: salen de los repuestos del catálogo que dicen
 * para qué marca y modelo son (lo que carga Importar catálogo) y de los
 * equipos ya recibidos, así un "otro modelo" escrito a mano aparece en
 * la lista la próxima vez.
 */

export interface MarcaConModelos {
  marca: string;
  modelos: string[];
}

const limpiar = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Agrupa pares marca/modelo, sin repetidos (sin importar mayúsculas) y en orden alfabético. */
export function agruparModelos(filas: { marca: string | null; modelo: string | null }[]): MarcaConModelos[] {
  const marcas = new Map<string, { marca: string; modelos: Map<string, string> }>();
  for (const f of filas) {
    const marca = limpiar(f.marca);
    const modelo = limpiar(f.modelo);
    if (!marca || !modelo) continue;
    let m = marcas.get(marca.toLowerCase());
    if (!m) {
      m = { marca, modelos: new Map() };
      marcas.set(marca.toLowerCase(), m);
    }
    if (!m.modelos.has(modelo.toLowerCase())) m.modelos.set(modelo.toLowerCase(), modelo);
  }
  const orden = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
  return [...marcas.values()]
    .map((m) => ({ marca: m.marca, modelos: [...m.modelos.values()].sort(orden) }))
    .sort((a, b) => orden(a.marca, b.marca));
}
