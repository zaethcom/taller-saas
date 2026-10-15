/**
 * Búsqueda de repuestos por palabras: "pantalla A10" tiene que encontrar
 * "Pantalla Galaxy A10 OLED" aunque las palabras no estén juntas. Cada
 * palabra debe aparecer en el código, la descripción, la marca, el
 * modelo o el nombre de la categoría del repuesto.
 */

/** Caracteres que rompen un filtro `or` de PostgREST o son comodines. */
const RESERVADOS = /[,()%*"\\:]/g;
const MAXIMO_PALABRAS = 6;

export function palabrasBusqueda(texto: string): string[] {
  return texto
    .replace(RESERVADOS, " ")
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, MAXIMO_PALABRAS);
}

/**
 * El filtro `or` de una palabra. `categoriaIds` son las categorías cuyo
 * nombre contiene la palabra: así "pantalla" o "batería" también traen
 * lo que está en esa categoría aunque la descripción no lo diga.
 */
export function filtroPalabra(palabra: string, categoriaIds: string[] = []): string {
  const p = `%${palabra}%`;
  const partes = [`codigo.ilike.${p}`, `descripcion.ilike.${p}`, `marca.ilike.${p}`, `modelo.ilike.${p}`];
  if (categoriaIds.length > 0) partes.push(`categoria_id.in.(${categoriaIds.join(",")})`);
  return partes.join(",");
}
