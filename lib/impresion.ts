/**
 * Encolar trabajos de impresión. La aplicación nunca habla de bytes ESC/POS
 * ni ZPL -- eso vive solo en estacion/. Aquí se escribe una fila en
 * trabajo_impresion con la carga YA RESUELTA (texto y números listos), y
 * la estación de la sede correspondiente la recoge y ejecuta.
 *
 * Ver supabase/migrations/0005_impresion.sql para el porqué de este diseño.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoTrabajo =
  | "etiqueta_qr"
  | "recibo_venta"
  | "comprobante_recepcion"
  | "cierre_caja"
  | "abrir_cajon"
  | "comprobante_traslado"
  | "etiqueta_articulo";

interface CargaEtiquetaQr {
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string;
  /** Lo agrega encolarImpresion(), igual que en los recibos. */
  empresaNombre: string;
}

/**
 * Los cuatro campos que identifican a la empresa en el papel -- nunca
 * los llena quien encola el trabajo (/api/ventas, /api/ordenes, etc.):
 * encolarImpresion() los agrega solos, leyendo empresa + empresa_config.
 *
 * Las etiquetas reciben solo el nombre: desde que se imprimen en la
 * misma impresora de tickets tienen sitio para un recuadro de marca,
 * pero repetir dirección, teléfono y pie en algo que se pega a un
 * equipo es gastar papel.
 */
interface CargaMarcaEmpresa {
  empresaNombre: string;
  empresaDireccion: string | null;
  empresaTelefono: string | null;
  reciboPie: string;
}

interface CargaReciboVenta extends CargaMarcaEmpresa {
  numeroVenta: number;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
  cajero?: string | null;
  montoRecibido?: number | null;
  cambio?: number | null;
}

interface CargaComprobanteRecepcion extends CargaMarcaEmpresa {
  numeroOrden: number;
  clienteNombre: string;
  producto: string;
  motivo: string;
  fecha: string;
  urlSeguimiento: string;
}

interface CargaCierreCaja extends CargaMarcaEmpresa {
  aperturaEn: string;
  cierreEn: string;
  baseInicial: number;
  totalVentas: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
}

interface CargaAbrirCajon {
  motivo: string;
}

interface CargaComprobanteTraslado extends CargaMarcaEmpresa {
  numeroTraslado: number;
  sedeOrigenNombre: string;
  sedeDestinoNombre: string;
  items: { descripcion: string; cantidad: number }[];
  nota: string | null;
  fecha: string;
}

interface CargaEtiquetaArticulo {
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  empresaNombre: string;
}

type CargaPorTipo = {
  etiqueta_qr: CargaEtiquetaQr;
  recibo_venta: CargaReciboVenta;
  comprobante_recepcion: CargaComprobanteRecepcion;
  cierre_caja: CargaCierreCaja;
  abrir_cajon: CargaAbrirCajon;
  comprobante_traslado: CargaComprobanteTraslado;
  etiqueta_articulo: CargaEtiquetaArticulo;
};

const TIPOS_CON_MARCA = new Set<TipoTrabajo>([
  "recibo_venta",
  "comprobante_recepcion",
  "cierre_caja",
  "comprobante_traslado",
]);

/** Las etiquetas: solo el nombre, para el recuadro de arriba. */
const TIPOS_CON_NOMBRE_EMPRESA = new Set<TipoTrabajo>([
  "etiqueta_qr",
  "etiqueta_articulo",
]);

export async function encolarImpresion<T extends TipoTrabajo>(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    sedeId: string;
    tipo: T;
    carga: Omit<CargaPorTipo[T], keyof CargaMarcaEmpresa>;
    creadoPor: string;
    /**
     * De qué orden es este trabajo -- por ahora solo importa para
     * 'etiqueta_qr', que es lo que el requisito tiene_etiqueta de
     * lib/estados.ts verifica contra un hecho real, no contra una
     * suposición.
     */
    ordenId?: string;
  },
): Promise<{ id: string }> {
  let carga: object = params.carga;

  // abrir_cajon no lleva nada de esto: no imprime papel. Los cuatro
  // tipos que son un recibo de verdad reciben la marca completa aquí,
  // una sola vez, en vez de que cada ruta que llama a encolarImpresion
  // tenga que acordarse de pedirla; las etiquetas, solo el nombre.
  if (TIPOS_CON_MARCA.has(params.tipo)) {
    const [{ data: empresa }, { data: config }] = await Promise.all([
      supabase.from("empresa").select("nombre").eq("id", params.empresaId).single(),
      supabase
        .from("empresa_config")
        .select("recibo_direccion, recibo_telefono, recibo_pie")
        .eq("empresa_id", params.empresaId)
        .maybeSingle(),
    ]);

    const marca: CargaMarcaEmpresa = {
      empresaNombre: empresa?.nombre ?? "",
      empresaDireccion: config?.recibo_direccion ?? null,
      empresaTelefono: config?.recibo_telefono ?? null,
      reciboPie: config?.recibo_pie ?? "Gracias por su preferencia",
    };
    carga = { ...params.carga, ...marca };
  } else if (TIPOS_CON_NOMBRE_EMPRESA.has(params.tipo)) {
    const { data: empresa } = await supabase
      .from("empresa")
      .select("nombre")
      .eq("id", params.empresaId)
      .single();

    carga = { ...params.carga, empresaNombre: empresa?.nombre ?? "" };
  }

  const { data, error } = await supabase
    .from("trabajo_impresion")
    .insert({
      empresa_id: params.empresaId,
      sede_id: params.sedeId,
      tipo: params.tipo,
      carga,
      creado_por: params.creadoPor,
      orden_id: params.ordenId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`No se pudo encolar el trabajo de impresión: ${error.message}`);
  }

  return { id: data.id as string };
}
