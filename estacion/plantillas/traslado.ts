import { alinear, componer, cortar, inicializar, negrita, salto, tamano, texto } from "../escpos";

export interface CargaComprobanteTraslado {
  numeroTraslado: number;
  sedeOrigenNombre: string;
  sedeDestinoNombre: string;
  items: { descripcion: string; cantidad: number }[];
  nota: string | null;
  fecha: string;
}

export function comprobanteTraslado(c: CargaComprobanteTraslado): Buffer {
  return componer(
    inicializar(),
    alinear("centro"),
    negrita(true),
    tamano(true),
    texto(`Traslado #${c.numeroTraslado}`),
    salto(),
    tamano(false),
    negrita(false),
    texto(c.fecha),
    salto(2),
    alinear("izquierda"),
    texto(`De:    ${c.sedeOrigenNombre}`),
    salto(),
    texto(`Para:  ${c.sedeDestinoNombre}`),
    salto(2),
    ...c.items.flatMap((i) => [texto(`${i.cantidad} x ${i.descripcion}`), salto()]),
    ...(c.nota ? [salto(), texto(`Nota: ${c.nota}`), salto()] : []),
    salto(3),
    alinear("centro"),
    texto("Firma quien envía"),
    salto(3),
    texto("Firma quien recibe"),
    salto(4),
    cortar(),
  );
}
