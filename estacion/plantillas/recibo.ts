import {
  abrirCajon,
  alinear,
  componer,
  cortar,
  inicializar,
  negrita,
  salto,
  tamano,
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

  const partes = [
    inicializar(),
    ...encabezadoEmpresa(c),
    salto(),
    negrita(true),
    texto(`Venta #${c.numeroVenta}`),
    negrita(false),
    salto(2),
    alinear("izquierda"),
  ];

  for (const item of c.items) {
    partes.push(texto(`${item.cantidad} x ${item.descripcion}`), salto());
    partes.push(alinear("derecha"), texto(fmt(item.cantidad * item.precioUnit)), salto());
    partes.push(alinear("izquierda"));
  }

  partes.push(
    salto(),
    negrita(true),
    alinear("derecha"),
    texto(`${c.etiquetaTotal ?? "TOTAL"} ${fmt(c.total)}`),
    salto(),
    negrita(false),
    texto(`Pagado con ${c.medioPago}`),
    salto(),
  );

  if (c.montoRecibido != null) {
    partes.push(texto(`Recibido ${fmt(c.montoRecibido)}`), salto());
  }
  if (c.cambio != null && c.cambio > 0) {
    partes.push(texto(`Cambio ${fmt(c.cambio)}`), salto());
  }
  if (c.cuentaOrden) {
    const cuenta = c.cuentaOrden;
    partes.push(salto(), alinear("izquierda"), negrita(true), texto(`Cuenta orden #${cuenta.numeroOrden}`), negrita(false), salto());
    partes.push(texto(`Valor del servicio ${fmt(cuenta.valor)}`), salto());
    const conPago = cuenta.estePago != null;
    if (cuenta.abonadoAntes > 0) {
      partes.push(texto(`${conPago ? "Abonado antes" : "Pagado"} ${fmt(cuenta.abonadoAntes)}`), salto());
    }
    if (conPago) partes.push(texto(`Este pago ${fmt(cuenta.estePago!)}`), salto());
    partes.push(negrita(true), texto(`SALDO ${fmt(cuenta.saldo)}`), negrita(false), salto(), alinear("derecha"));
  }
  if (c.cajero) {
    partes.push(texto(`Atendió: ${c.cajero}`), salto());
  }

  partes.push(salto(2), ...piePersonalizado(c), salto(3), cortar());

  if (c.abreCajon) {
    partes.push(abrirCajon());
  }

  return componer(...partes);
}
