import { alinear, componer, cortar, imagenRaster, inicializar, negrita, salto, tamano, texto } from "../escpos";
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
}

/**
 * El comprobante que se lleva el cliente al dejar el equipo -- rediseñado
 * a partir de la maqueta que mandó el usuario (logo, secciones Cliente/
 * Equipo, QR grande, código del equipo repetido en grande, nota legal).
 * No imprime la URL cruda: el QR ya la codifica, y el código de entrada
 * (mismo que lleva la etiqueta física) es lo que de verdad necesita
 * poder leer alguien a simple vista si no puede escanear.
 */
export function comprobanteRecepcion(c: CargaComprobanteRecepcion): Buffer {
  return componer(
    inicializar(),
    ...encabezadoEmpresa(c),
    salto(),
    alinear("centro"),
    negrita(true),
    tamano(true),
    texto("RECEPCIÓN DE EQUIPO"),
    tamano(false),
    negrita(false),
    salto(2),

    alinear("izquierda"),
    negrita(true),
    texto(`Orden #${c.numeroOrden}`),
    negrita(false),
    texto(`  -  ${c.codigoEntrada}`),
    salto(),
    texto(c.fecha),
    salto(2),

    negrita(true),
    texto("CLIENTE"),
    negrita(false),
    salto(),
    texto(c.clienteNombre + (c.clienteTelefono ? ` - ${c.clienteTelefono}` : "")),
    salto(2),

    negrita(true),
    texto("EQUIPO"),
    negrita(false),
    salto(),
    texto(c.producto),
    salto(),
    texto(`Serial: ${c.serial}`),
    salto(),
    texto(`Motivo: ${c.motivo}`),
    salto(2),

    alinear("centro"),
    ...(c.qrRaster
      ? [imagenRaster(c.qrRaster.anchoDots, c.qrRaster.altoDots, Buffer.from(c.qrRaster.datosBase64, "base64")), salto()]
      : []),
    negrita(true),
    texto("ESCANEA PARA CONSULTAR TU ORDEN"),
    negrita(false),
    salto(),
    texto("Historial - Estado - Diagnostico - Entrega"),
    salto(2),

    negrita(true),
    tamano(true),
    texto(`CÓDIGO: ${c.codigoEntrada}`),
    tamano(false),
    negrita(false),
    salto(2),

    texto("Conserve este comprobante para consultar y"),
    salto(),
    texto("reclamar su equipo. El QR es único para esta orden."),
    salto(2),

    ...piePersonalizado(c),
    salto(3),
    cortar(),
    // El comprobante de recepción a menudo se cobra un anticipo al
    // mismo tiempo: abrir el cajón queda a criterio de quien construya
    // esa pantalla, llamando a abrirCajon() aparte si aplica.
  );
}
