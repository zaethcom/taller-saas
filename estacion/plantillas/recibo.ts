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

export interface CargaReciboVenta {
  numeroVenta: number;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  total: number;
  medioPago: string;
  abreCajon: boolean;
  cajero?: string | null;
  montoRecibido?: number | null;
  cambio?: number | null;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function reciboVenta(c: CargaReciboVenta): Buffer {
  const partes = [
    inicializar(),
    alinear("centro"),
    negrita(true),
    tamano(true),
    texto("Recibo de venta"),
    salto(),
    tamano(false),
    negrita(false),
    texto(`Venta #${c.numeroVenta}`),
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
    texto(`TOTAL ${fmt(c.total)}`),
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
  if (c.cajero) {
    partes.push(texto(`Atendió: ${c.cajero}`), salto());
  }

  partes.push(
    salto(2),
    alinear("centro"),
    texto("Gracias por su compra"),
    salto(3),
    cortar(),
  );

  if (c.abreCajon) {
    partes.push(abrirCajon());
  }

  return componer(...partes);
}
