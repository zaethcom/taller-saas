import {
  ajustar,
  alinear,
  columnasPapel,
  componer,
  cortar,
  imagenRaster,
  inicializar,
  INTERLINEADO_COMPACTO,
  interlineado,
  juntar,
  negrita,
  renglones,
  salto,
  tamano,
  texto,
} from "../escpos";
import { encabezadoEmpresa, piePersonalizado, type CargaMarcaEmpresa, type LogoRaster } from "../marca";

export interface CargaComprobanteRecepcion extends CargaMarcaEmpresa {
  numeroOrden: number;
  codigoEntrada: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  producto: string;
  serial: string;
  motivo: string;
  fecha: string;
  urlSeguimiento: string;
  // Bitmap, no comando nativo -- ver lib/qr-bitmap.ts: confirmado en
  // hardware real que la impresora Perto/PERTO Printer TEC no
  // interpreta el GS ( k de escpos.ts::qr() y lo imprime como texto
  // literal.
  qrRaster?: LogoRaster;
  /** Valor del servicio acordado al recibir; con abono, también el saldo. */
  valorServicio?: number | null;
  abono?: { monto: number; medio: string } | null;
  saldo?: number | null;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Valor, abono y saldo, si se acordó un valor al recibir. */
function cuentaRecepcion(c: CargaComprobanteRecepcion): Buffer[] {
  if (!c.valorServicio || c.valorServicio <= 0) return [];
  const abono = c.abono?.monto ?? 0;
  const saldo = c.saldo ?? Math.max(0, c.valorServicio - abono);
  return [
    texto(`Valor del servicio: ${fmt(c.valorServicio)}`),
    salto(),
    ...(abono > 0 ? [texto(`Abono: ${fmt(abono)} (${c.abono!.medio})`), salto()] : []),
    negrita(true),
    texto(`SALDO: ${fmt(saldo)}`),
    negrita(false),
    salto(),
  ];
}

/**
 * El comprobante que se lleva el cliente al dejar el equipo: logo,
 * número de orden en grande, cliente, equipo, cuenta y el QR del
 * seguimiento. Compactado para gastar menos papel: un renglón por dato
 * (sin títulos de sección aparte), interlineado corto, QR más chico y
 * sin el código repetido al final -- el número de orden en grande y el
 * código de entrada arriba ya bastan para buscarla sin escanear. No
 * imprime la URL cruda: el QR ya la codifica.
 */
export function comprobanteRecepcion(c: CargaComprobanteRecepcion): Buffer {
  const columnas = columnasPapel(c.anchoPapelMm);
  const angosto = c.anchoPapelMm === 58;

  return componer(
    inicializar(),
    interlineado(INTERLINEADO_COMPACTO),
    ...encabezadoEmpresa(c),
    salto(),
    negrita(true),
    texto("RECEPCION DE EQUIPO"),
    salto(),
    tamano(true),
    texto(`ORDEN #${c.numeroOrden}`),
    tamano(false),
    negrita(false),
    salto(),
    ...renglones(juntar([c.codigoEntrada, c.fecha], columnas)),

    alinear("izquierda"),
    ...renglones(juntar([`Cliente: ${c.clienteNombre}`, c.clienteTelefono ?? ""], columnas)),
    ...renglones(juntar([`Equipo: ${c.producto}`, `Serial: ${c.serial}`], columnas)),
    ...renglones(ajustar(`Motivo: ${c.motivo}`, columnas)),
    ...cuentaRecepcion(c),

    alinear("centro"),
    ...(c.qrRaster
      ? [imagenRaster(c.qrRaster.anchoDots, c.qrRaster.altoDots, Buffer.from(c.qrRaster.datosBase64, "base64")), salto()]
      : []),
    negrita(true),
    texto(angosto ? "Escanea para ver tu orden" : "Escanea para ver el estado de tu orden"),
    negrita(false),
    salto(),
    texto(angosto ? "Conserve este recibo" : "Conserve este recibo para reclamar su equipo"),
    salto(),

    ...piePersonalizado(c),
    // GS V 66 ya avanza el papel hasta la cuchilla antes de cortar.
    salto(),
    cortar(),
    // El comprobante de recepción a menudo se cobra un anticipo al
    // mismo tiempo: abrir el cajón queda a criterio de quien construya
    // esa pantalla, llamando a abrirCajon() aparte si aplica.
  );
}
