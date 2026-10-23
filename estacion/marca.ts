/**
 * El encabezado y pie que identifican a la empresa en cada recibo --
 * compartido entre las plantillas que sí son un recibo de verdad
 * (recibo, comprobante, cierre, traslado). Nace de
 * lib/impresion.ts:CargaMarcaEmpresa, que agrega estos campos solo,
 * sin que la pantalla que encola el trabajo tenga que pedirlos.
 */
import { ajustar, alinear, areaImpresion, columnasPapel, imagenRaster, juntar, renglones, negrita, salto, tamano, texto } from "./escpos";

export interface LogoRaster {
  anchoDots: number;
  altoDots: number;
  datosBase64: string;
}

export interface CargaMarcaEmpresa {
  empresaNombre: string;
  empresaDireccion: string | null;
  empresaTelefono: string | null;
  reciboPie: string;
  logoRaster?: LogoRaster | null;
  /** Ancho del rollo de tickets de la sede (58 u 80 mm); sin él, 80. */
  anchoPapelMm?: 58 | 80 | null;
}

export function encabezadoEmpresa(c: CargaMarcaEmpresa): Buffer[] {
  // El margen y el ancho útil van aquí porque todos los recibos de verdad
  // empiezan por este encabezado, justo después de ESC @.
  const partes: Buffer[] = [areaImpresion(c.anchoPapelMm), alinear("centro")];

  if (c.logoRaster) {
    partes.push(
      imagenRaster(c.logoRaster.anchoDots, c.logoRaster.altoDots, Buffer.from(c.logoRaster.datosBase64, "base64")),
      salto(),
    );
  }

  partes.push(negrita(true), tamano(true), texto(c.empresaNombre || "Taller 360"), salto(), tamano(false), negrita(false));

  // Dirección y teléfono en un solo renglón cuando caben, para no gastar
  // papel en cada recibo.
  const telefono = c.empresaTelefono ? `Tel: ${c.empresaTelefono}` : "";
  partes.push(...renglones(juntar([c.empresaDireccion ?? "", telefono], columnasPapel(c.anchoPapelMm))));
  return partes;
}

/** El mensaje de cierre, para los recibos que de verdad van al cliente. */
export function piePersonalizado(c: CargaMarcaEmpresa): Buffer[] {
  return [alinear("centro"), ...renglones(ajustar(c.reciboPie, columnasPapel(c.anchoPapelMm)))];
}
