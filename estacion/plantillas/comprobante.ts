import { alinear, componer, cortar, inicializar, negrita, qr, salto, tamano, texto } from "../escpos";
import { encabezadoEmpresa, piePersonalizado, type CargaMarcaEmpresa } from "../marca";

export interface CargaComprobanteRecepcion extends CargaMarcaEmpresa {
  numeroOrden: number;
  clienteNombre: string;
  producto: string;
  motivo: string;
  fecha: string;
  urlSeguimiento: string;
}

export function comprobanteRecepcion(c: CargaComprobanteRecepcion): Buffer {
  return componer(
    inicializar(),
    ...encabezadoEmpresa(c),
    salto(),
    negrita(true),
    texto("Comprobante de recepción"),
    negrita(false),
    salto(),
    texto(`Orden #${c.numeroOrden} · ${c.fecha}`),
    salto(2),
    alinear("izquierda"),
    negrita(true),
    texto("Cliente: "),
    negrita(false),
    texto(c.clienteNombre),
    salto(),
    negrita(true),
    texto("Equipo: "),
    negrita(false),
    texto(c.producto),
    salto(),
    negrita(true),
    texto("Motivo: "),
    negrita(false),
    texto(c.motivo),
    salto(2),
    alinear("centro"),
    texto("Consulte el estado de su orden:"),
    salto(),
    qr(c.urlSeguimiento),
    salto(),
    texto(c.urlSeguimiento),
    salto(2),
    ...piePersonalizado(c),
    salto(3),
    cortar(),
    // El comprobante de recepción a menudo se cobra un anticipo al
    // mismo tiempo: abrir el cajón queda a criterio de quien construya
    // esa pantalla, llamando a abrirCajon() aparte si aplica.
  );
}
