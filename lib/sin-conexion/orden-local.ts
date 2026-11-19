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
import { esEstado, siguientesEstados, type Estado } from "../estados";
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
    orden = copia.ordenesAbiertas.find((o) => o.cuenta?.tokenPublico && o.cuenta.tokenPublico === q.token);
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

/**
 * La orden recibida sin conexión, agregada a la copia (fase 4): así se
 * puede abonar o entregar por su número mientras sigue sin internet. El
 * QR todavía no existe (el token lo pone el servidor al subirla).
 */
export function aplicarRecepcionEnCopia(
  copia: CopiaLocal,
  r: {
    id: string;
    numero: number;
    abiertaEn: string;
    motivo: string;
    valorServicio: number;
    abono: number;
    medioAbono: string | null;
    clienteId: string | null;
    clienteNombre: string | null;
    clienteTelefono: string | null;
    serial: string | null;
    tipo: string | null;
    marca: string | null;
    modelo: string | null;
    telefonoAlterno: string | null;
  },
): CopiaLocal {
  const orden: OrdenLocal = {
    id: r.id,
    numero: r.numero,
    estado: "en_proceso",
    abiertaEn: r.abiertaEn,
    total: r.valorServicio,
    telefonoAlterno: r.telefonoAlterno,
    clienteId: r.clienteId,
    serial: r.serial,
    tipo: r.tipo,
    marca: r.marca,
    modelo: r.modelo,
    cuenta: {
      motivo: r.motivo,
      tokenPublico: "",
      clienteNombre: r.clienteNombre,
      clienteTelefono: r.clienteTelefono,
      valor: r.valorServicio,
      pagado: r.abono,
      saldo: Math.max(0, r.valorServicio - r.abono),
      pagos: r.abono > 0 ? [{ numero: 0, tipo: "anticipo", monto: r.abono, medio: r.medioAbono, fecha: r.abiertaEn }] : [],
      items: r.valorServicio > 0 ? [{ descripcion: r.motivo, cantidad: 1, precioUnit: r.valorServicio, repuestoId: null }] : [],
    },
  };
  return { ...copia, ordenesAbiertas: [orden, ...copia.ordenesAbiertas.filter((o) => o.id !== r.id)] };
}

export function descripcionRecepcion(numeroOrden: number, cliente: string | null): string {
  return `Recepción orden #${numeroOrden}${cliente ? ` · ${cliente}` : ""}`;
}

/**
 * La orden que busca el técnico al escanear, sin internet: por el token
 * del QR, por el serial del equipo, o por el número o el código de
 * entrada de la etiqueta. null si no está entre las abiertas de la copia.
 */
export function buscarOrdenTaller(copia: CopiaLocal, q: { token?: string | null; texto?: string | null }): OrdenLocal | null {
  if (q.token) return copia.ordenesAbiertas.find((o) => o.cuenta?.tokenPublico && o.cuenta.tokenPublico === q.token) ?? null;
  const texto = (q.texto ?? "").trim();
  if (!texto) return null;
  const serial = texto.toUpperCase();
  const porSerial = copia.ordenesAbiertas.find((o) => (o.serial ?? "").trim().toUpperCase() === serial);
  if (porSerial) return porSerial;
  const numero = /^\d+$/.test(texto) ? Number(texto) : numeroDesdeCodigoEntrada(copia.prefijoEtiqueta, texto);
  return numero ? (copia.ordenesAbiertas.find((o) => o.numero === numero) ?? null) : null;
}

/** La copia con el estado nuevo de la orden (cambio hecho sin conexión). No cambia la original. */
export function aplicarEstadoEnCopia(copia: CopiaLocal, ordenId: string, estado: string): CopiaLocal {
  return { ...copia, ordenesAbiertas: copia.ordenesAbiertas.map((o) => (o.id === ordenId ? { ...o, estado } : o)) };
}

export function descripcionEstado(numeroOrden: number, etiqueta: string): string {
  return `Orden #${numeroOrden} → ${etiqueta}`;
}

/** Los estados a los que el técnico puede pasar sin internet: todos menos entregar (eso es del mostrador). */
export function estadosSinConexion(estado: string): Estado[] {
  return esEstado(estado) ? siguientesEstados(estado).filter((e) => e !== "entregada") : [];
}
