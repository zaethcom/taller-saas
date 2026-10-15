import {
  abrirCajon,
  alinear,
  COLUMNAS_TICKET,
  componer,
  cortar,
  dosColumnas,
  inicializar,
  INTERLINEADO_COMPACTO,
  interlineado,
  negrita,
  salto,
  texto,
} from "../escpos";
import { encabezadoEmpresa, piePersonalizado, type CargaMarcaEmpresa } from "../marca";

export interface CargaReciboVenta extends CargaMarcaEmpresa {
  numeroVenta: number;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
  cajero?: string | null;
  montoRecibido?: number | null;
  cambio?: number | null;
  // "Imprimir recibo" desmarcado en el cobro -- default true porque
  // casi todo el código existente (reimpresión, etiqueta_qr nunca pasa
  // por acá) nunca manda este campo. El cajón se abre igual: abrirlo o
  // no depende solo de abreCajon, nunca de esto.
  imprimir?: boolean;
  /** "TOTAL" por defecto; "ABONO" en el recibo de un abono a una orden. */
  etiquetaTotal?: string;
  /** Cobro ligado a una orden: valor, lo abonado antes y el saldo que queda. */
  cuentaOrden?: {
    numeroOrden: number;
    valor: number;
    abonadoAntes: number;
    /** Lo pagado en este recibo; sin él (reimpresión al entregar), solo valor, abonado y saldo. */
    estePago?: number | null;
    saldo: number;
  } | null;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function reciboVenta(c: CargaReciboVenta): Buffer {
  if (c.imprimir === false) {
    // Sin ticket de texto -- nada que darle al cliente -- pero el
    // cajón se abre igual si el pago fue en efectivo: desmarcar
    // "Imprimir recibo" no debe tener ningún efecto sobre eso.
    return componer(inicializar(), ...(c.abreCajon ? [abrirCajon()] : []));
  }

  // Compacto a propósito: interlineado corto, ítem y monto en un mismo
  // renglón, pago/recibido/cambio juntos y sin renglones en blanco de
  // relleno -- el recibo largo gastaba demasiado papel.
  const partes = [
    inicializar(),
    interlineado(INTERLINEADO_COMPACTO),
    ...encabezadoEmpresa(c),
    negrita(true),
    texto(`Venta #${c.numeroVenta}`),
    negrita(false),
    salto(),
    alinear("izquierda"),
  ];

  const renglon = (izq: string, der: string) => {
    const junto = dosColumnas(izq, der);
    if (junto) partes.push(texto(junto), salto());
    else partes.push(texto(izq), salto(), alinear("derecha"), texto(der), salto(), alinear("izquierda"));
  };

  for (const item of c.items) {
    renglon(`${item.cantidad} x ${item.descripcion}`, fmt(item.cantidad * item.precioUnit));
  }

  partes.push(texto("-".repeat(COLUMNAS_TICKET)), salto(), negrita(true));
  renglon(c.etiquetaTotal ?? "TOTAL", fmt(c.total));
  partes.push(negrita(false));

  const pago = [`Pagado con ${c.medioPago}`];
  if (c.montoRecibido != null) pago.push(`Recibido ${fmt(c.montoRecibido)}`);
  if (c.cambio != null && c.cambio > 0) pago.push(`Cambio ${fmt(c.cambio)}`);
  partes.push(texto(pago.join(" - ")), salto());

  if (c.cuentaOrden) {
    const cuenta = c.cuentaOrden;
    const conPago = cuenta.estePago != null;
    partes.push(texto(`Orden #${cuenta.numeroOrden} - Valor del servicio ${fmt(cuenta.valor)}`), salto());
    const pagos: string[] = [];
    if (cuenta.abonadoAntes > 0) pagos.push(`${conPago ? "Abonado antes" : "Pagado"} ${fmt(cuenta.abonadoAntes)}`);
    if (conPago) pagos.push(`Este pago ${fmt(cuenta.estePago!)}`);
    if (pagos.length) partes.push(texto(pagos.join(" - ")), salto());
    partes.push(negrita(true));
    renglon("SALDO", fmt(cuenta.saldo));
    partes.push(negrita(false));
  }
  if (c.cajero) {
    partes.push(texto(`Atendió: ${c.cajero}`), salto());
  }

  // GS V 66 ya avanza el papel hasta la cuchilla antes de cortar: un
  // solo renglón de margen basta para que el pie no quede pegado al corte.
  partes.push(...piePersonalizado(c), salto(), cortar());

  if (c.abreCajon) {
    partes.push(abrirCajon());
  }

  return componer(...partes);
}
