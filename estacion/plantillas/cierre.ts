import { alinear, componer, cortar, inicializar, negrita, salto, tamano, texto } from "../escpos";
import { encabezadoEmpresa, type CargaMarcaEmpresa } from "../marca";

export interface CargaCierreCaja extends CargaMarcaEmpresa {
  aperturaEn: string;
  cierreEn: string;
  baseInicial: number;
  totalVentas: number;
  ingresos?: number;
  salidas?: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  /** Quién abrió y quién cerró el turno, ya como texto: "Pepito Pérez (Cajero)".
   *  Opcionales: los trabajos encolados antes de este cambio no los traen. */
  abiertoPor?: string;
  cerradoPor?: string;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function cierreCaja(c: CargaCierreCaja): Buffer {
  const signo = c.diferencia === 0 ? "CUADRA" : c.diferencia > 0 ? "SOBRA" : "FALTA";

  return componer(
    inicializar(),
    ...encabezadoEmpresa(c),
    salto(),
    negrita(true),
    texto("Cierre de caja"),
    negrita(false),
    salto(),
    alinear("izquierda"),
    // Una línea por fecha: juntas no caben en 80 mm y la hora quedaba partida.
    texto(`Apertura: ${c.aperturaEn}`),
    salto(),
    texto(`Cierre:   ${c.cierreEn}`),
    salto(),
    // Quién responde por la caja. Si abrió y cerró la misma persona, una línea.
    ...(c.cerradoPor && (!c.abiertoPor || c.abiertoPor === c.cerradoPor)
      ? [texto(`Responsable: ${c.cerradoPor}`), salto()]
      : [
          ...(c.abiertoPor ? [texto(`Abrió:  ${c.abiertoPor}`), salto()] : []),
          ...(c.cerradoPor ? [texto(`Cerró:  ${c.cerradoPor}`), salto()] : []),
        ]),
    salto(),
    texto(`Base inicial:      ${fmt(c.baseInicial)}`),
    salto(),
    texto(`Ventas del turno:  ${fmt(c.totalVentas)}`),
    salto(),
    // Ingresos/salidas de la gestión de dinero, solo si hubo.
    ...(c.ingresos ? [texto(`Ingresos de caja:  ${fmt(c.ingresos)}`), salto()] : []),
    ...(c.salidas ? [texto(`Salidas de caja:  -${fmt(c.salidas)}`), salto()] : []),
    texto(`Efectivo esperado: ${fmt(c.efectivoEsperado)}`),
    salto(),
    texto(`Efectivo contado:  ${fmt(c.efectivoContado)}`),
    salto(2),
    negrita(true),
    texto(`${signo}: ${fmt(Math.abs(c.diferencia))}`),
    negrita(false),
    salto(3),
    alinear("centro"),
    texto("________________________"),
    salto(),
    // El nombre bajo la raya: la firma queda atada a una persona, no a "alguien".
    ...(c.cerradoPor ? [texto(c.cerradoPor), salto()] : []),
    texto("Firma responsable"),
    salto(4),
    cortar(),
  );
}
