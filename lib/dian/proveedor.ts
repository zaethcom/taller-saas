/**
 * El integrador DIAN concreto. Placeholder a propósito: la Fase 0 del
 * plano de construcción pide cotizar dos integradores antes de escribir
 * código de facturación -- nunca se implementa la DIAN a mano.
 *
 * Cuando se elija uno (Factus, Alegra, Siigo, etc.), esta es la ÚNICA
 * pieza que cambia: implementar ProveedorDian contra su API y exportarla
 * aquí. Nada más en el proyecto debe tocarse.
 */
import {
  DianNoConfiguradoError,
  type FacturaEmitida,
  type ProveedorDian,
  type SolicitudFactura,
} from "./interfaz";

class ProveedorPendiente implements ProveedorDian {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async emitirFactura(solicitud: SolicitudFactura): Promise<FacturaEmitida> {
    throw new DianNoConfiguradoError();
  }
}

export const proveedorDian: ProveedorDian = new ProveedorPendiente();
