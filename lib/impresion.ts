/**
 * Encolar trabajos de impresión. La aplicación nunca habla de bytes ESC/POS
 * ni ZPL -- eso vive solo en estacion/. Aquí se escribe una fila en
 * trabajo_impresion con la carga YA RESUELTA (texto y números listos), y
 * la estación de la sede correspondiente la recoge y ejecuta.
 *
 * Ver supabase/migrations/0005_impresion.sql para el porqué de este diseño.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generarLogoRaster, type LogoRaster } from "./logo-bitmap";

export type TipoTrabajo =
  | "etiqueta_qr"
  | "recibo_venta"
  | "comprobante_recepcion"
  | "cierre_caja"
  | "abrir_cajon"
  | "comprobante_traslado"
  | "etiqueta_articulo"
  | "etiqueta_repuesto";

interface CargaEtiquetaQr {
  nombreEmpresa: string;
  codigoEntrada: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroOrden: number;
  contenidoQr: string;
}

/**
 * Los campos que identifican a la empresa en el papel -- nunca los
 * llena quien encola el trabajo (/api/ventas, /api/ordenes, etc.):
 * encolarImpresion() los agrega solos, leyendo empresa + empresa_config,
 * para los tipos que de verdad son un recibo y no una etiqueta pequeña
 * sin espacio para esto.
 */
interface CargaMarcaEmpresa {
  empresaNombre: string;
  empresaDireccion: string | null;
  empresaTelefono: string | null;
  reciboPie: string;
  logoRaster?: LogoRaster | null;
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
  codigoEntrada: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  producto: string;
  serial: string;
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
}

interface CargaEtiquetaRepuesto {
  nombreEmpresa: string;
  codigo: string;
  descripcion: string;
  cantidadCopias: number;
}

type CargaPorTipo = {
  etiqueta_qr: CargaEtiquetaQr;
  recibo_venta: CargaReciboVenta;
  comprobante_recepcion: CargaComprobanteRecepcion;
  cierre_caja: CargaCierreCaja;
  abrir_cajon: CargaAbrirCajon;
  comprobante_traslado: CargaComprobanteTraslado;
  etiqueta_articulo: CargaEtiquetaArticulo;
  etiqueta_repuesto: CargaEtiquetaRepuesto;
};

const TIPOS_CON_MARCA = new Set<TipoTrabajo>([
  "recibo_venta",
  "comprobante_recepcion",
  "cierre_caja",
  "comprobante_traslado",
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

  // Las etiquetas (etiqueta_qr, etiqueta_articulo) y abrir_cajon no
  // llevan esto -- son demasiado pequeñas o no imprimen texto de
  // empresa en absoluto. Los cuatro tipos que sí son un recibo de
  // verdad lo reciben aquí, una sola vez, en vez de que cada ruta que
  // llama a encolarImpresion tenga que acordarse de pedirlo.
  if (TIPOS_CON_MARCA.has(params.tipo)) {
    const [{ data: empresa }, { data: config }] = await Promise.all([
      supabase.from("empresa").select("nombre").eq("id", params.empresaId).single(),
      supabase
        .from("empresa_config")
        .select("recibo_direccion, recibo_telefono, recibo_pie, logo_url")
        .eq("empresa_id", params.empresaId)
        .maybeSingle(),
    ]);

    const marca: CargaMarcaEmpresa = {
      empresaNombre: empresa?.nombre ?? "",
      empresaDireccion: config?.recibo_direccion ?? null,
      empresaTelefono: config?.recibo_telefono ?? null,
      reciboPie: config?.recibo_pie ?? "Gracias por su preferencia",
      logoRaster: await generarLogoRaster(config?.logo_url),
    };
    carga = { ...params.carga, ...marca };
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
