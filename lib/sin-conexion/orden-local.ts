/**
 * Cobrar y entregar sin internet (plan sin internet, fase 3b): buscar la
 * orden en la copia local y cómo queda la copia después de un abono o
 * de una entrega hechos sin conexión, para que el mostrador vea el saldo
 * real mientras sigue sin internet.
 *
 * La forma de la orden es la misma que devuelve /api/ordenes/buscar, así
 * la pantalla no distingue si vino del servidor o de la copia.
 */
import { numeroDesdeCodigoEntrada } from "../codigo-entrada";
import type { CopiaLocal, OrdenLocal } from "./tipos";

export interface OrdenBuscada {
  id: string;
  numero: number;
  estado: string;
  total: number;
  motivo: string | null;
  token_publico: string;
  valor: number;
  pagado: number;
  pagos: { numero: number; tipo: string; monto: number; medio: string | null; fecha: string }[];
  saldoPendiente: number;
  items: { descripcion: string; cantidad: number; precioUnit: number; repuestoId: string | null }[];
  producto: {
    marca: string | null;
    modelo: string | null;
    tipo: string;
    serial: string;
    cliente: { nombre: string; telefono: string | null } | null;
  };
}

function aBuscada(o: OrdenLocal): OrdenBuscada | null {
  const c = o.cuenta;
  if (!c) return null;
  return {
    id: o.id,
    numero: o.numero,
    estado: o.estado,
    total: o.total ?? 0,
    motivo: c.motivo,
    token_publico: c.tokenPublico,
    valor: c.valor,
    pagado: c.pagado,
    pagos: c.pagos,
    saldoPendiente: c.saldo,
    items: c.items,
    producto: {
      marca: o.marca,
      modelo: o.modelo,
      tipo: o.tipo ?? "",
      serial: o.serial ?? "",
      cliente: c.clienteNombre ? { nombre: c.clienteNombre, telefono: c.clienteTelefono } : null,
    },
  };
}

/** Lo mismo que /api/ordenes/buscar?numero= | ?token=, desde la copia. null si no está. */
export function buscarOrdenLocal(copia: CopiaLocal, q: { numero?: string | null; token?: string | null }): OrdenBuscada | null {
  let orden: OrdenLocal | undefined;
  if (q.token) {
    orden = copia.ordenesAbiertas.find((o) => o.cuenta?.tokenPublico === q.token);
  } else if (q.numero) {
    const texto = q.numero.trim();
    const numero = /^\d+$/.test(texto) ? Number(texto) : numeroDesdeCodigoEntrada(copia.prefijoEtiqueta, texto);
    if (numero) orden = copia.ordenesAbiertas.find((o) => o.numero === numero);
  }
  return orden ? aBuscada(orden) : null;
}

/** La copia con el abono sumado a lo pagado de la orden. No cambia la original. */
export function aplicarAbonoEnCopia(
  copia: CopiaLocal,
  ordenId: string,
  abono: { monto: number; medio: string | null; fecha: string; tipo?: string },
): CopiaLocal {
  return {
    ...copia,
    ordenesAbiertas: copia.ordenesAbiertas.map((o) => {
      if (o.id !== ordenId || !o.cuenta) return o;
      const pagado = o.cuenta.pagado + abono.monto;
      return {
        ...o,
        cuenta: {
          ...o.cuenta,
          pagado,
          saldo: Math.max(0, o.cuenta.valor - pagado),
          // Sin número todavía: lo pone el servidor al subirlo.
          pagos: [...o.cuenta.pagos, { numero: 0, tipo: abono.tipo ?? "anticipo", monto: abono.monto, medio: abono.medio, fecha: abono.fecha }],
        },
      };
    }),
  };
}

/** La copia sin la orden entregada: ya no está abierta. No cambia la original. */
export function aplicarEntregaEnCopia(copia: CopiaLocal, ordenId: string): CopiaLocal {
  return { ...copia, ordenesAbiertas: copia.ordenesAbiertas.filter((o) => o.id !== ordenId) };
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function descripcionAbono(numeroOrden: number, monto: number): string {
  return `Abono orden #${numeroOrden} · ${fmt(monto)}`;
}

export function descripcionCobroOrden(numeroOrden: number, monto: number): string {
  return `Cobro orden #${numeroOrden} · ${fmt(monto)}`;
}

export function descripcionEntrega(numeroOrden: number): string {
  return `Entrega orden #${numeroOrden}`;
}
