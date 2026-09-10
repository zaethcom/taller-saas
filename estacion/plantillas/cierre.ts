import { alinear, componer, cortar, inicializar, negrita, salto, tamano, texto } from "../escpos";

export interface CargaCierreCaja {
  aperturaEn: string;
  cierreEn: string;
  baseInicial: number;
  totalVentas: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function cierreCaja(c: CargaCierreCaja): Buffer {
  const signo = c.diferencia === 0 ? "CUADRA" : c.diferencia > 0 ? "SOBRA" : "FALTA";

  return componer(
    inicializar(),
    alinear("centro"),
    negrita(true),
    tamano(true),
    texto("Cierre de caja"),
    salto(),
    tamano(false),
    negrita(false),
    texto(`${c.aperturaEn} — ${c.cierreEn}`),
    salto(2),
    alinear("izquierda"),
    texto(`Base inicial:      ${fmt(c.baseInicial)}`),
    salto(),
    texto(`Ventas del turno:  ${fmt(c.totalVentas)}`),
    salto(),
    texto(`Efectivo esperado: ${fmt(c.efectivoEsperado)}`),
    salto(),
    texto(`Efectivo contado:  ${fmt(c.efectivoContado)}`),
    salto(2),
    negrita(true),
    texto(`${signo}: ${fmt(Math.abs(c.diferencia))}`),
    negrita(false),
    salto(3),
    alinear("centro"),
    texto("Firma responsable"),
    salto(4),
    cortar(),
  );
}
