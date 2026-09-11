/**
 * El encabezado y pie que identifican a la empresa en cada recibo --
 * compartido entre las plantillas que sí son un recibo de verdad
 * (recibo, comprobante, cierre, traslado). Nace de
 * lib/impresion.ts:CargaMarcaEmpresa, que agrega estos cuatro campos
 * solo, sin que la pantalla que encola el trabajo tenga que pedirlos.
 */
import { alinear, negrita, salto, tamano, texto } from "./escpos";

export interface CargaMarcaEmpresa {
  empresaNombre: string;
  empresaDireccion: string | null;
  empresaTelefono: string | null;
  reciboPie: string;
}

export function encabezadoEmpresa(c: CargaMarcaEmpresa): Buffer[] {
  const partes = [
    alinear("centro"),
    negrita(true),
    tamano(true),
    texto(c.empresaNombre || "Taller SaaS"),
    salto(),
    tamano(false),
    negrita(false),
  ];
  if (c.empresaDireccion) {
    partes.push(texto(c.empresaDireccion), salto());
  }
  if (c.empresaTelefono) {
    partes.push(texto(`Tel: ${c.empresaTelefono}`), salto());
  }
  return partes;
}

/** El mensaje de cierre, para los recibos que de verdad van al cliente. */
export function piePersonalizado(c: CargaMarcaEmpresa): Buffer[] {
  return [alinear("centro"), texto(c.reciboPie), salto()];
}
