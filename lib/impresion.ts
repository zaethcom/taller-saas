/**
 * Encolar trabajos de impresión. La aplicación nunca habla de bytes ESC/POS
 * ni ZPL -- eso vive solo en estacion/. Aquí se escribe una fila en
 * trabajo_impresion con la carga YA RESUELTA (texto y números listos), y
 * la estación de la sede correspondiente la recoge y ejecuta.
 *
 * Ver supabase/migrations/0005_impresion.sql para el porqué de este diseño.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generarLogoRaster, TAMANO_RECIBO, TAMANO_RECIBO_58, type LogoRaster } from "./logo-bitmap";
import { generarEtiquetaQrRaster } from "./etiqueta-bitmap";
import { generarQrRaster } from "./qr-bitmap";
import { rasterEtiqueta } from "./etiquetas/renderizar";
import {
  COLUMNAS_PLANTILLA,
  filaAPlantilla,
  type DatosEtiqueta,
  type FilaPlantilla,
  type PlantillaEtiqueta,
  type UsoEtiqueta,
} from "./etiquetas/plantilla";

export type TipoTrabajo =
  | "etiqueta_qr"
  | "recibo_venta"
  | "comprobante_recepcion"
  | "cierre_caja"
  | "abrir_cajon"
  | "comprobante_traslado"
  | "etiqueta_articulo"
  | "etiqueta_repuesto";

/**
 * La etiqueta física es de 30x25mm -- solo entra el QR (escaneable, el
 * código de entrada) y el mismo código en texto grande como respaldo.
 * El resto de los datos de la orden ya va en el comprobante impreso,
 * que sí tiene espacio.
 */
interface CargaEtiquetaQr {
  codigoEntrada: string;
  /** Marca/modelo del equipo -- solo lo usa una plantilla con "descripción" (0046). */
  producto?: string | null;
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
  anchoPapelMm?: 58 | 80 | null;
}

interface CargaReciboVenta extends CargaMarcaEmpresa {
  numeroVenta: number;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
  cajero?: string | null;
  /** A quién se le vendió; sin él (consumidor final) el recibo no dice nada. */
  cliente?: { nombre: string; documento: string | null; telefono: string | null } | null;
  montoRecibido?: number | null;
  cambio?: number | null;
  imprimir?: boolean;
  /** "TOTAL" por defecto; "ABONO" en el recibo de un abono a una orden. */
  etiquetaTotal?: string;
  /** Cobro ligado a una orden: valor, lo abonado antes y el saldo que queda. */
  cuentaOrden?: CuentaOrdenImpresa | null;
}

interface CuentaOrdenImpresa {
  numeroOrden: number;
  valor: number;
  abonadoAntes: number;
  estePago?: number | null;
  saldo: number;
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
  qrRaster?: LogoRaster;
  /** Valor del servicio acordado al recibir; con abono, también el saldo. */
  valorServicio?: number | null;
  abono?: { monto: number; medio: string } | null;
  saldo?: number | null;
}

interface CargaCierreCaja extends CargaMarcaEmpresa {
  aperturaEn: string;
  cierreEn: string;
  baseInicial: number;
  totalVentas: number;
  /** Dinero metido y sacado de la caja sin venta (0054_movimiento_caja.sql). */
  ingresos?: number;
  salidas?: number;
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

const USO_POR_TIPO: Partial<Record<TipoTrabajo, UsoEtiqueta>> = {
  etiqueta_qr: "orden",
  etiqueta_articulo: "articulo",
  etiqueta_repuesto: "repuesto",
};

/** Qué se imprime en una etiqueta con plantilla, sacado de la carga de cada tipo. */
function datosDeCarga(tipo: TipoTrabajo, carga: Record<string, unknown>): DatosEtiqueta {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  switch (tipo) {
    case "etiqueta_qr":
      return { codigo: String(carga.codigoEntrada ?? ""), descripcion: texto(carga.producto) };
    case "etiqueta_articulo":
      return {
        codigo: String(carga.codigo ?? ""),
        descripcion: [carga.marca, carga.modelo].filter((v) => texto(v)).join(" ") || texto(carga.tipo),
      };
    default:
      return {
        codigo: String(carga.codigo ?? ""),
        empresa: texto(carga.nombreEmpresa),
        descripcion: texto(carga.descripcion),
      };
  }
}

/**
 * Logo y eslogan de la empresa (Configuración > Marca), solo si la
 * plantilla los usa -- así una etiqueta sin logo no hace la consulta.
 */
export async function marcaParaEtiqueta(
  supabase: SupabaseClient,
  empresaId: string,
  campos: string[],
): Promise<Pick<DatosEtiqueta, "logoUrl" | "eslogan">> {
  if (!campos.includes("logo") && !campos.includes("eslogan")) return {};
  const { data } = await supabase
    .from("empresa_config")
    .select("logo_url, eslogan")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return { logoUrl: data?.logo_url ?? null, eslogan: data?.eslogan ?? null };
}

/**
 * Si el uso de esta etiqueta tiene plantilla activa (/configuracion),
 * la etiqueta se dibuja completa como bitmap con esa plantilla. La
 * carga original se conserva al lado: una estación vieja, que todavía
 * no sabe de `etiquetaRaster` para artículos y repuestos, sigue
 * imprimiendo la etiqueta de fábrica con esos mismos datos.
 *
 * Devuelve null si no hay plantilla (o si dibujarla falla) -- entonces
 * se imprime la etiqueta de fábrica, nunca se pierde el trabajo.
 */
async function aplicarPlantilla(
  supabase: SupabaseClient,
  empresaId: string,
  tipo: TipoTrabajo,
  carga: Record<string, unknown>,
  forzada?: PlantillaEtiqueta,
): Promise<Record<string, unknown> | null> {
  const uso = USO_POR_TIPO[tipo];
  if (!uso) return null;

  let plantilla = forzada ?? null;
  if (!plantilla) {
    const { data } = await supabase
      .from("plantilla_etiqueta")
      .select(COLUMNAS_PLANTILLA)
      .eq("empresa_id", empresaId)
      .eq("uso", uso)
      .eq("activa", true)
      .maybeSingle();
    if (!data) return null;
    plantilla = filaAPlantilla(data as FilaPlantilla);
  }

  try {
    const datos = datosDeCarga(tipo, carga);
    if (plantilla.campos.includes("empresa") && !datos.empresa) {
      const { data: empresa } = await supabase.from("empresa").select("nombre").eq("id", empresaId).single();
      datos.empresa = empresa?.nombre ?? null;
    }
    Object.assign(datos, await marcaParaEtiqueta(supabase, empresaId, plantilla.campos));
    return { ...carga, etiquetaRaster: await rasterEtiqueta(plantilla, datos) };
  } catch (err) {
    console.error("[impresion] no se pudo dibujar la etiqueta con la plantilla; sale la de fábrica", err);
    return null;
  }
}

const TIPOS_CON_MARCA = new Set<TipoTrabajo>([
  "recibo_venta",
  "comprobante_recepcion",
  "cierre_caja",
  "comprobante_traslado",
]);

// Las etiquetas también: en una sede sin etiquetadora salen por la POS
// de tickets (estacion/etiqueta-escpos.ts) y se achican al rollo de 58mm.
const TIPOS_ETIQUETA = new Set<TipoTrabajo>(["etiqueta_qr", "etiqueta_articulo", "etiqueta_repuesto"]);

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
    /**
     * Imprimir con esta plantilla en vez de la activa -- solo para la
     * impresión de prueba desde /configuracion.
     */
    plantillaEtiqueta?: PlantillaEtiqueta;
  },
): Promise<{ id: string }> {
  let carga: object = params.carga;

  // Ancho del rollo de tickets de la sede (migración 0060): sin la
  // columna o sin configurar, 80 mm como siempre.
  let anchoPapelMm: 58 | 80 = 80;
  if (TIPOS_CON_MARCA.has(params.tipo) || TIPOS_ETIQUETA.has(params.tipo)) {
    const { data: papel } = await supabase
      .from("impresora_sede")
      .select("tickets_ancho_mm")
      .eq("sede_id", params.sedeId)
      .maybeSingle();
    if (papel?.tickets_ancho_mm === 58) anchoPapelMm = 58;
  }

  // Las etiquetas (etiqueta_qr, etiqueta_articulo) y abrir_cajon no
  // llevan esto -- son demasiado pequeñas o no imprimen texto de
  // empresa en absoluto. Los cuatro tipos que sí son un recibo de
  // verdad lo reciben aquí, una sola vez, en vez de que cada ruta que
  // llama a encolarImpresion tenga que acordarse de pedirlo.
  if (TIPOS_CON_MARCA.has(params.tipo)) {
    const [{ data: empresa }, { data: config }, { data: sedeConfig }] = await Promise.all([
      supabase.from("empresa").select("nombre").eq("id", params.empresaId).single(),
      supabase
        .from("empresa_config")
        .select("recibo_direccion, recibo_telefono, recibo_pie, logo_url")
        .eq("empresa_id", params.empresaId)
        .maybeSingle(),
      // Lo que esta sede sobrescribe (dirección/teléfono/pie/logo propios,
      // por si son dos locales físicos distintos) -- lo que no sobrescribe
      // cae al de empresa_config, campo por campo.
      supabase
        .from("sede_config")
        .select("recibo_direccion, recibo_telefono, recibo_pie, logo_url")
        .eq("sede_id", params.sedeId)
        .maybeSingle(),
    ]);

    const marca: CargaMarcaEmpresa = {
      empresaNombre: empresa?.nombre ?? "",
      empresaDireccion: sedeConfig?.recibo_direccion ?? config?.recibo_direccion ?? null,
      empresaTelefono: sedeConfig?.recibo_telefono ?? config?.recibo_telefono ?? null,
      reciboPie: sedeConfig?.recibo_pie ?? config?.recibo_pie ?? "Gracias por su preferencia",
      logoRaster: await generarLogoRaster(
        sedeConfig?.logo_url ?? config?.logo_url,
        anchoPapelMm === 58 ? TAMANO_RECIBO_58 : TAMANO_RECIBO,
      ),
      anchoPapelMm,
    };
    carga = { ...params.carga, ...marca };
  }

  // La etiqueta_qr no manda comandos de texto/QR nativos -- todo el
  // diseño (QR + código + marco) se renderiza acá como una sola imagen
  // (ver lib/etiqueta-bitmap.ts) y estacion/ solo la embebe en el
  // comando PPLB `GW`. Quien encola solo pide el código de entrada
  // (`{ codigoEntrada }`), igual que antes -- este archivo se encarga
  // de convertirlo en la imagen.
  //
  // Con una plantilla activa (0046) para el uso de la etiqueta, la
  // dibuja la plantilla en vez de esto -- para etiqueta_qr y también
  // para etiqueta_articulo/etiqueta_repuesto, que sin plantilla siguen
  // con sus comandos nativos de siempre.
  const conPlantilla = await aplicarPlantilla(
    supabase,
    params.empresaId,
    params.tipo,
    params.carga as Record<string, unknown>,
    params.plantillaEtiqueta,
  );
  if (conPlantilla) {
    carga = params.tipo === "etiqueta_qr" ? { etiquetaRaster: conPlantilla.etiquetaRaster } : conPlantilla;
  } else if (params.tipo === "etiqueta_qr") {
    const { codigoEntrada } = params.carga as unknown as { codigoEntrada: string };
    carga = { etiquetaRaster: await generarEtiquetaQrRaster(codigoEntrada) };
  }

  // Solo cuenta si la etiqueta termina en la POS (estacion/etiqueta-escpos.ts);
  // PPLB/ZPL lo ignoran. Con 80mm no se agrega nada: la carga queda igual que antes.
  if (TIPOS_ETIQUETA.has(params.tipo) && anchoPapelMm === 58) {
    carga = { ...carga, anchoPapelMm };
  }

  // El QR del comprobante de recepción se manda como bitmap, no como
  // comando nativo -- ver lib/qr-bitmap.ts sobre por qué (no lo
  // interpreta el hardware real de alguna sedes).
  if (params.tipo === "comprobante_recepcion") {
    const { urlSeguimiento } = params.carga as unknown as { urlSeguimiento: string };
    carga = {
      ...carga,
      qrRaster: anchoPapelMm === 58 ? await generarQrRaster(urlSeguimiento, 192, 384) : await generarQrRaster(urlSeguimiento),
    };
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
