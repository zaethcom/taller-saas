import {
  abrirCajon,
  ajustar,
  altoDoble,
  alinear,
  columnasPapel,
  componer,
  cortar,
  dosColumnas,
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
import { encabezadoEmpresa, piePersonalizado, type CargaMarcaEmpresa } from "../marca";

export interface CargaReciboVenta extends CargaMarcaEmpresa {
  numeroVenta: number;
  /** «22/10/2026 7:39 p. m.»: lo pone lib/impresion.ts al encolar (o la venta original al reimprimir). */
  fecha?: string;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
  cajero?: string | null;
  /** A quién se le vendió; sin él (consumidor final) el recibo no dice nada. */
  cliente?: { nombre: string; documento: string | null; telefono: string | null } | null;
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
    numeroOrden?: number;
    /** En vez de "Orden #N": p. ej. "Encargo: vidrio templado". */
    titulo?: string;
    /** "Valor del servicio" por defecto. */
    etiquetaValor?: string;
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
    salto(),
    // El número de venta en grande: es lo que se busca al reclamar o devolver.
    negrita(true),
    tamano(true),
    texto(`Venta #${c.numeroVenta}`),
    tamano(false),
    negrita(false),
    salto(),
    ...(c.fecha ? [texto(c.fecha), salto()] : []),
    salto(),
    alinear("izquierda"),
  ];

  const columnas = columnasPapel(c.anchoPapelMm);
  if (c.cliente) {
    partes.push(...renglones(ajustar(`Cliente: ${c.cliente.nombre}`, columnas)));
    const datos = [c.cliente.documento ? `Doc. ${c.cliente.documento}` : "", c.cliente.telefono ? `Tel. ${c.cliente.telefono}` : ""];
    partes.push(...renglones(juntar(datos, columnas)));
    partes.push(texto("-".repeat(columnas)), salto());
  }
  // Texto a la izquierda y monto a la derecha; si no caben juntos, el
  // texto se parte por palabras y el monto va al final del último renglón
  // (o debajo, alineado a la derecha).
  // `ancho`: letras por renglón; la mitad cuando la letra va a doble ancho.
  const renglon = (izq: string, der: string, ancho = columnas) => {
    const lineas = ajustar(izq, ancho);
    const ultima = lineas.pop() ?? "";
    partes.push(...renglones(lineas));
    const junto = dosColumnas(ultima, der, ancho);
    if (junto) partes.push(texto(junto), salto());
    else partes.push(texto(ultima), salto(), alinear("derecha"), texto(der), salto(), alinear("izquierda"));
  };

  // Los ítems a doble alto: la letra normal se leía muy pequeña. Doble alto
  // no le quita letras al renglón, así que el monto sigue cabiendo al lado.
  partes.push(altoDoble(true));
  for (const item of c.items) {
    renglon(`${item.cantidad} x ${item.descripcion}`, fmt(item.cantidad * item.precioUnit));
  }
  partes.push(altoDoble(false));

  // El total a doble alto y doble ancho: la mitad de letras por renglón.
  partes.push(texto("-".repeat(columnas)), salto(), negrita(true), tamano(true));
  renglon(c.etiquetaTotal ?? "TOTAL", fmt(c.total), Math.floor(columnas / 2));
  partes.push(tamano(false), negrita(false));

  const pago = [`Pagado con ${c.medioPago}`];
  if (c.montoRecibido != null) pago.push(`Recibido ${fmt(c.montoRecibido)}`);
  if (c.cambio != null && c.cambio > 0) pago.push(`Cambio ${fmt(c.cambio)}`);
  partes.push(...renglones(juntar(pago, columnas)));

  if (c.cuentaOrden) {
    const cuenta = c.cuentaOrden;
    const conPago = cuenta.estePago != null;
    const datos = [
      cuenta.titulo ?? `Orden #${cuenta.numeroOrden}`,
      `${cuenta.etiquetaValor ?? "Valor del servicio"} ${fmt(cuenta.valor)}`,
    ];
    if (cuenta.abonadoAntes > 0) datos.push(`${conPago ? "Abonado antes" : "Pagado"} ${fmt(cuenta.abonadoAntes)}`);
    if (conPago) datos.push(`Este pago ${fmt(cuenta.estePago!)}`);
    partes.push(...renglones(juntar(datos, columnas)));
    partes.push(negrita(true));
    renglon("SALDO", fmt(cuenta.saldo));
    partes.push(negrita(false));
  }
  if (c.cajero) {
    partes.push(...renglones(ajustar(`Atendió: ${c.cajero}`, columnas)));
  }

  // GS V 66 ya avanza el papel hasta la cuchilla antes de cortar: un
  // solo renglón de margen basta para que el pie no quede pegado al corte.
  partes.push(...piePersonalizado(c), salto(), cortar());

  if (c.abreCajon) {
    partes.push(abrirCajon());
  }

  return componer(...partes);
}
