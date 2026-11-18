/**
 * La copia de datos de una sede guardada en el equipo para trabajar sin
 * internet (plan sin internet, fase 2). La arma /api/app/copia-local y
 * la completa el navegador (componentes/sin-conexion/sincronizar-copia.tsx).
 *
 * Las formas de repuestos y artículos son las mismas que devuelven
 * /api/repuestos?venta=1 y /api/inventario/articulos?disponibles=1, más
 * los campos que hacen falta para buscar sin el servidor (marca, modelo,
 * categoría). Así Vender usa la copia sin cambiar sus tipos.
 */
export interface RepuestoLocal {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string | null;
  modelo: string | null;
  categoriaId: string | null;
  precioVenta: number;
  imagenUrl: string | null;
  existenciaAqui: number;
  reservadoAqui: number;
}

export interface ArticuloLocal {
  id: string;
  numero: number;
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  precio_venta: number;
  imagen_url: string | null;
  categoriaId: string | null;
}

export interface ClienteLocal {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface OrdenLocal {
  id: string;
  numero: number;
  estado: string;
  abiertaEn: string;
  total: number | null;
  telefonoAlterno: string | null;
  clienteId: string | null;
  serial: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
}

export interface CopiaLocal {
  version: 1;
  generadaEn: string;
  empresaId: string;
  sedeId: string;
  usuarioId: string;
  repuestos: RepuestoLocal[];
  articulos: ArticuloLocal[];
  clientes: ClienteLocal[];
  ordenesAbiertas: OrdenLocal[];
  categorias: { id: string; nombre: string }[];
  metodosPago: { id: string; nombre: string; es_efectivo: boolean; activo?: boolean; orden?: number }[];
  /** La última respuesta de /api/turno/actual. */
  turno: Record<string, unknown> | null;
}
