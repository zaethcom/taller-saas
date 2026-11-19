/**
 * Consultas del admin sin internet: tablero de órdenes, existencias y
 * clientes, desde la copia local (componentes/sin-conexion/
 * consulta-sin-conexion.tsx). Solo consulta: cambiar datos de esas
 * pantallas sigue pidiendo internet.
 *
 * Cada palabra del texto debe aparecer en alguno de los campos, sin
 * importar mayúsculas ni tildes, igual que el buscador de inventario.
 */
import { numeroDesdeCodigoEntrada } from "../codigo-entrada";
import type { ArticuloLocal, ClienteLocal, CopiaLocal, OrdenLocal, RepuestoLocal } from "./tipos";

export const MAXIMO_FILAS = 200;

function normalizar(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function palabras(texto: string): string[] {
  return normalizar(texto).split(/\s+/).filter(Boolean);
}

function coincide(campos: (string | number | null | undefined)[], buscadas: string[]): boolean {
  if (buscadas.length === 0) return true;
  const todo = normalizar(campos.map((c) => (c == null ? "" : String(c))).join(" "));
  return buscadas.every((p) => todo.includes(p));
}

/** Órdenes abiertas de la copia (incluye las recibidas sin conexión), la más nueva primero. */
export function ordenesLocal(copia: CopiaLocal, texto: string): OrdenLocal[] {
  const buscadas = palabras(texto);
  // El código de entrada de la etiqueta ("PS000014") también encuentra la orden.
  const porCodigo = texto.trim() ? numeroDesdeCodigoEntrada(copia.prefijoEtiqueta, texto.trim()) : null;
  return copia.ordenesAbiertas
    .filter(
      (o) =>
        (porCodigo != null && o.numero === porCodigo) ||
        coincide(
          [o.numero, o.serial, o.tipo, o.marca, o.modelo, o.telefonoAlterno, o.cuenta?.clienteNombre, o.cuenta?.clienteTelefono, o.cuenta?.motivo],
          buscadas,
        ),
    )
    .sort((a, b) => b.numero - a.numero)
    .slice(0, MAXIMO_FILAS);
}

export type FilaExistencia =
  | { clase: "repuesto"; id: string; codigo: string; nombre: string; precio: number; disponible: number; reservado: number }
  | { clase: "articulo"; id: string; codigo: string; nombre: string; precio: number; serie: string | null };

function filaRepuesto(r: RepuestoLocal): FilaExistencia {
  return {
    clase: "repuesto",
    id: r.id,
    codigo: r.codigo,
    nombre: [r.descripcion, r.marca, r.modelo].filter(Boolean).join(" · "),
    precio: r.precioVenta,
    disponible: r.existenciaAqui,
    reservado: r.reservadoAqui,
  };
}

function filaArticulo(a: ArticuloLocal): FilaExistencia {
  return {
    clase: "articulo",
    id: a.id,
    codigo: a.codigo,
    nombre: [a.tipo, a.marca, a.modelo].filter(Boolean).join(" · "),
    precio: a.precio_venta,
    serie: a.numero_serie,
  };
}

/** Repuestos y artículos de la sede según la copia. */
export function existenciasLocal(copia: CopiaLocal, texto: string): FilaExistencia[] {
  const buscadas = palabras(texto);
  const categoria = new Map(copia.categorias.map((c) => [c.id, c.nombre]));
  const repuestos = copia.repuestos
    .filter((r) => coincide([r.codigo, r.descripcion, r.marca, r.modelo, r.categoriaId ? categoria.get(r.categoriaId) : null], buscadas))
    .map(filaRepuesto);
  const articulos = copia.articulos
    .filter((a) => coincide([a.codigo, a.numero, a.tipo, a.marca, a.modelo, a.numero_serie, a.categoriaId ? categoria.get(a.categoriaId) : null], buscadas))
    .map(filaArticulo);
  return [...repuestos, ...articulos].sort((x, y) => x.nombre.localeCompare(y.nombre, "es")).slice(0, MAXIMO_FILAS);
}

/** Clientes de la copia por nombre, documento, teléfono o correo. */
export function clientesLocal(copia: CopiaLocal, texto: string): ClienteLocal[] {
  const buscadas = palabras(texto);
  return copia.clientes
    .filter((c) => coincide([c.nombre, c.documento, c.telefono, c.correo], buscadas))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, MAXIMO_FILAS);
}

/** Qué consulta sin internet corresponde a una ruta del admin, o null si esa pantalla necesita internet. */
export function consultaDeRuta(ruta: string): "ordenes" | "existencias" | "clientes" | null {
  if (ruta === "/ordenes") return "ordenes";
  if (ruta === "/inventario") return "existencias";
  if (ruta === "/clientes") return "clientes";
  return null;
}
