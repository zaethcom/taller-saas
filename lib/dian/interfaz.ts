/**
 * Lo único que el resto del código conoce de la facturación electrónica.
 * Cambiar de integrador DIAN es reemplazar proveedor.ts -- nunca tocar
 * los archivos que llaman a emitirFactura().
 */

export interface ItemFactura {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

export interface SolicitudFactura {
  numeroVenta: number;
  clienteDocumento: string | null;
  clienteNombre: string | null;
  items: ItemFactura[];
  total: number;
}

export interface FacturaEmitida {
  cufe: string;
  numeroFactura: string;
  urlPdf: string;
  emitidaEn: string;
}

export interface ProveedorDian {
  emitirFactura(solicitud: SolicitudFactura): Promise<FacturaEmitida>;
}

export class DianNoConfiguradoError extends Error {
  constructor() {
    super(
      "No hay integrador DIAN configurado. Ver lib/dian/proveedor.ts y las " +
        "variables de entorno DIAN_* -- sección 1 del plano de construcción.",
    );
    this.name = "DianNoConfiguradoError";
  }
}
