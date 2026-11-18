/**
 * Las búsquedas de Vender contra la copia local, cuando no hay internet
 * (plan sin internet, fase 2). Imitan las del servidor para que el
 * mostrador no note diferencia:
 *
 * - Repuestos (/api/repuestos?venta=1): cada palabra debe aparecer en el
 *   código, la descripción, la marca, el modelo o el nombre de la
 *   categoría (lib/busqueda-repuesto.ts). Máximo 15.
 * - Artículos (/api/inventario/articulos?disponibles=1): con un número,
 *   ese número de artículo; si no, el texto en tipo, marca, modelo o
 *   serie. Máximo 15.
 * - Clientes (/api/clientes): por documento o teléfono con las mismas
 *   reglas (lib/busqueda-cliente.ts) y, con nombre=1, por nombre.
 */
import { palabrasBusqueda } from "../busqueda-repuesto";
import { clientesCoincidentes, type ClienteEncontrado } from "../busqueda-cliente";
import type { ArticuloLocal, ClienteLocal, CopiaLocal, RepuestoLocal } from "./tipos";

export const LIMITE_BUSQUEDA = 15;
const MAXIMO_CLIENTES = 8;

function contiene(valor: string | null | undefined, palabra: string): boolean {
  return (valor ?? "").toLocaleLowerCase("es").includes(palabra);
}

export function buscarRepuestosLocal(copia: CopiaLocal, texto: string, categoriaId?: string | null): RepuestoLocal[] {
  const palabras = palabrasBusqueda(texto).map((p) => p.toLocaleLowerCase("es"));
  const nombreCategoria = new Map(copia.categorias.map((c) => [c.id, c.nombre]));
  const resultado: RepuestoLocal[] = [];
  for (const r of copia.repuestos) {
    if (r.existenciaAqui <= 0) continue;
    if (categoriaId && r.categoriaId !== categoriaId) continue;
    const categoria = r.categoriaId ? nombreCategoria.get(r.categoriaId) : null;
    const coincide = palabras.every(
      (p) =>
        contiene(r.codigo, p) ||
        contiene(r.descripcion, p) ||
        contiene(r.marca, p) ||
        contiene(r.modelo, p) ||
        contiene(categoria, p),
    );
    if (!coincide) continue;
    resultado.push(r);
    if (resultado.length >= LIMITE_BUSQUEDA) break;
  }
  return resultado;
}

export function buscarArticulosLocal(copia: CopiaLocal, texto: string, categoriaId?: string | null): ArticuloLocal[] {
  const buscar = texto.trim();
  const numero = buscar.match(/(\d+)/)?.[1];
  const t = buscar.toLocaleLowerCase("es");
  const resultado: ArticuloLocal[] = [];
  for (const a of copia.articulos) {
    if (categoriaId && a.categoriaId !== categoriaId) continue;
    if (buscar) {
      const coincide = numero
        ? a.numero === Number(numero)
        : contiene(a.tipo, t) || contiene(a.marca, t) || contiene(a.modelo, t) || contiene(a.numero_serie, t);
      if (!coincide) continue;
    }
    resultado.push(a);
    if (resultado.length >= LIMITE_BUSQUEDA) break;
  }
  return resultado;
}

export function buscarClientesLocal(clientes: ClienteLocal[], texto: string, porNombre: boolean): ClienteEncontrado[] {
  const encontrados = clientesCoincidentes(clientes, texto);
  if (porNombre) {
    const palabras = texto
      .split(/\s+/)
      .filter((p) => /\p{L}/u.test(p))
      .map((p) => p.toLocaleLowerCase("es"));
    if (palabras.join("").length >= 3) {
      const vistos = new Set(encontrados.map((c) => c.id));
      const porNombreLista = clientes
        .filter((c) => !vistos.has(c.id) && palabras.every((p) => contiene(c.nombre, p)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      for (const c of porNombreLista) encontrados.push({ ...c, coincide: "nombre" });
    }
  }
  return encontrados.slice(0, MAXIMO_CLIENTES);
}
