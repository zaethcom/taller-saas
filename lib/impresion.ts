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
}

interface CargaReciboVenta {
  numeroVenta: number;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
}

interface CargaComprobanteRecepcion {
  numeroOrden: number;
  clienteNombre: string;
  producto: string;
  motivo: string;
  fecha: string;
  urlSeguimiento: string;
}

interface CargaCierreCaja {
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

interface CargaComprobanteTraslado {
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

type CargaPorTipo = {
  etiqueta_qr: CargaEtiquetaQr;
  recibo_venta: CargaReciboVenta;
  comprobante_recepcion: CargaComprobanteRecepcion;
  cierre_caja: CargaCierreCaja;
  abrir_cajon: CargaAbrirCajon;
  comprobante_traslado: CargaComprobanteTraslado;
  etiqueta_articulo: CargaEtiquetaArticulo;
};

export async function encolarImpresion<T extends TipoTrabajo>(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    sedeId: string;
    tipo: T;
    carga: CargaPorTipo[T];
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
  const { data, error } = await supabase
    .from("trabajo_impresion")
    .insert({
      empresa_id: params.empresaId,
      sede_id: params.sedeId,
      tipo: params.tipo,
      carga: params.carga,
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
