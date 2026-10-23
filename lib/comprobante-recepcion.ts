/**
 * Volver a imprimir el comprobante de recepción de una orden con los
 * datos que tiene hoy -- para cuando el cliente nota en el papel que
 * el teléfono quedó mal: se corrige la orden (/ordenes/<id>/editar) y
 * sale un comprobante nuevo con lo corregido.
 *
 * El valor, lo abonado y el saldo salen de la cuenta de la orden
 * (lib/cuenta-orden.ts), así que si ya hubo más abonos o una
 * cotización, el papel nuevo los refleja.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { encolarImpresion } from "./impresion";
import { fechaHoraRecibo } from "./fecha-recibo";
import { codigoEntrada } from "./codigo-entrada";
import { obtenerCuentaOrden, type CuentaOrden } from "./cuenta-orden";

export interface DatosComprobante {
  numero: number;
  prefijoEtiqueta: string | null;
  abiertaEn: string;
  motivo: string;
  tokenPublico: string;
  telefonoAlterno: string | null;
  cliente: { nombre: string; telefono: string | null } | null;
  producto: { serial: string; tipo: string; marca: string | null; modelo: string | null } | null;
  cuenta: Pick<CuentaOrden, "valor" | "pagado" | "saldo" | "pagos"> | null;
  /** Nombre de quien recibió el equipo (autor del primer evento de la orden). */
  recibidoPor?: string | null;
}

/** La carga del trabajo 'comprobante_recepcion', igual a la que arma /api/ordenes al recibir. */
export function cargaComprobanteRecepcion(d: DatosComprobante, urlApp: string) {
  const producto = d.producto;
  const nombreProducto = [producto?.marca, producto?.modelo].filter(Boolean).join(" ") || producto?.tipo || "";
  const valor = d.cuenta?.valor ?? 0;
  const pagado = d.cuenta?.pagado ?? 0;
  const medios = [...new Set((d.cuenta?.pagos ?? []).map((p) => p.medio).filter((m): m is string => Boolean(m)))];
  return {
    numeroOrden: d.numero,
    codigoEntrada: codigoEntrada(d.prefijoEtiqueta, d.numero),
    clienteNombre: d.cliente?.nombre ?? "",
    clienteTelefono: d.cliente?.telefono ?? d.telefonoAlterno ?? null,
    producto: nombreProducto,
    serial: producto?.serial ?? "",
    motivo: d.motivo,
    fecha: fechaHoraRecibo(d.abiertaEn),
    urlSeguimiento: `${urlApp}/seguimiento/${d.tokenPublico}`,
    valorServicio: valor > 0 ? valor : null,
    abono: valor > 0 && pagado > 0 ? { monto: pagado, medio: medios.length > 1 ? "varios" : (medios[0] ?? "—") } : null,
    saldo: valor > 0 ? (d.cuenta?.saldo ?? valor - pagado) : null,
    recibidoPor: d.recibidoPor ?? null,
  };
}

/**
 * Encola el comprobante en la sede en la que está trabajando quien lo
 * pide. Devuelve null si la orden no es de esa empresa.
 */
export async function reimprimirComprobanteRecepcion(
  supabase: SupabaseClient,
  params: { ordenId: string; empresaId: string; sedeId: string; creadoPor: string },
): Promise<{ id: string } | null> {
  const [{ data: orden }, { data: config }, cuenta, { data: recepcion }] = await Promise.all([
    supabase
      .from("orden")
      .select(
        "numero, empresa_id, abierta_en, motivo, token_publico, telefono_alterno, producto:producto_id ( serial, tipo, marca, modelo, cliente:cliente_id ( nombre, telefono ) )",
      )
      .eq("id", params.ordenId)
      .maybeSingle(),
    supabase.from("empresa_config").select("prefijo_etiqueta").eq("empresa_id", params.empresaId).maybeSingle(),
    obtenerCuentaOrden(supabase, params.ordenId),
    // Quién recibió el equipo: el autor del primer evento de la orden (el que
    // inserta /api/ordenes al crearla). La orden no guarda ese dato aparte.
    supabase
      .from("orden_evento")
      .select("autor:autor_id ( nombre )")
      .eq("orden_id", params.ordenId)
      .order("ocurrio_en", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!orden || orden.empresa_id !== params.empresaId) return null;

  // El join de Supabase infiere las relaciones 1:1 como arreglos.
  const producto = orden.producto as unknown as
    | (NonNullable<DatosComprobante["producto"]> & { cliente: DatosComprobante["cliente"] })
    | null;

  const carga = cargaComprobanteRecepcion(
    {
      numero: orden.numero,
      prefijoEtiqueta: config?.prefijo_etiqueta ?? null,
      abiertaEn: orden.abierta_en,
      motivo: orden.motivo,
      tokenPublico: orden.token_publico,
      telefonoAlterno: orden.telefono_alterno,
      cliente: producto?.cliente ?? null,
      producto,
      cuenta,
      recibidoPor: (recepcion?.autor as unknown as { nombre: string } | null)?.nombre ?? null,
    },
    process.env.NEXT_PUBLIC_APP_URL ?? "",
  );

  return encolarImpresion(supabase, {
    empresaId: params.empresaId,
    sedeId: params.sedeId,
    tipo: "comprobante_recepcion",
    creadoPor: params.creadoPor,
    carga,
  });
}
