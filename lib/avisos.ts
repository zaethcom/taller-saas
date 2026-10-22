/**
 * Avisos al taller por lo que hace el cliente en el enlace de
 * seguimiento (0061_avisos_cliente.sql). Lo que no depende del
 * servidor ni del navegador -- qué dice cada aviso y cómo se arma la
 * notificación -- vive aquí para poder probarlo.
 */

import { puede, puedeEntrarA, type Rol } from "./permisos";

export type TipoAviso =
  | "mensaje"
  | "cotizacion_aprobada"
  | "cotizacion_rechazada"
  | "item_aprobado"
  | "item_rechazado"
  /** Compras marcó recibido un repuesto de la orden (0062_compra_por_orden.sql). */
  | "repuesto_recibido";

export const ETIQUETA_AVISO: Record<TipoAviso, string> = {
  mensaje: "Mensaje del cliente",
  cotizacion_aprobada: "Aprobó la cotización",
  cotizacion_rechazada: "Rechazó la cotización",
  item_aprobado: "Aprobó un costo adicional",
  item_rechazado: "Rechazó un costo adicional",
  repuesto_recibido: "Llegó el repuesto",
};

/** Largo máximo del texto guardado en el aviso (el mensaje completo sigue en orden_mensaje). */
export const LARGO_TEXTO_AVISO = 300;

export function recortarTexto(texto: string, largo = LARGO_TEXTO_AVISO): string {
  const limpio = texto.trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1)}…` : limpio;
}

/** El texto que acompaña cada tipo: el mensaje mismo, el motivo del rechazo o el ítem decidido. */
export function textoAviso(tipo: TipoAviso, detalle?: string | null): string {
  const d = detalle?.trim() ?? "";
  switch (tipo) {
    case "mensaje":
      return recortarTexto(d);
    case "cotizacion_aprobada":
      return "El cliente aprobó la cotización desde el enlace.";
    case "cotizacion_rechazada":
      return recortarTexto(d ? `El cliente rechazó la cotización. Motivo: ${d}` : "El cliente rechazó la cotización.");
    case "item_aprobado":
      return recortarTexto(d ? `El cliente aprobó: ${d}` : "El cliente aprobó un costo adicional.");
    case "item_rechazado":
      return recortarTexto(d ? `El cliente rechazó: ${d}` : "El cliente rechazó un costo adicional.");
    case "repuesto_recibido":
      return recortarTexto(`${d ? `Llegó ${d}.` : "Llegó el repuesto."} La orden está lista para seguir.`);
  }
}

export interface NotificacionAviso {
  titulo: string;
  cuerpo: string;
  url: string;
  /** Mismo tag = la notificación nueva de una orden reemplaza la anterior en vez de apilarse. */
  tag: string;
}

/** Lo que se manda por push (y lo que muestra el service worker). */
export function notificacionDeAviso(a: {
  tipo: TipoAviso;
  texto: string;
  ordenId: string;
  numero: number | null;
  cliente: string | null;
  /** urlAviso(): depende del rol de quien recibe. */
  url: string;
}): NotificacionAviso {
  const quien = a.cliente?.trim() || "El cliente";
  const orden = a.numero != null ? `Orden #${a.numero}` : "Orden";
  const titulo =
    a.tipo === "mensaje" ? `${quien} escribió · ${orden}` : `${ETIQUETA_AVISO[a.tipo]} · ${orden}`;
  return {
    titulo,
    cuerpo: a.tipo === "mensaje" || !esDelCliente(a.tipo) ? a.texto : `${quien}: ${a.texto}`,
    url: a.url,
    tag: `orden-${a.ordenId}`,
  };
}

/** Los avisos que salen de algo que hizo el cliente (el resto los genera el taller). */
export function esDelCliente(tipo: TipoAviso): boolean {
  return tipo !== "repuesto_recibido";
}

/**
 * A dónde lleva tocar un aviso. Quien entra al taller va directo a los
 * mensajes de la orden; recepción y compras no entran a /orden/[id], así
 * que van a su pantalla de inicio (ATERRIZAJE_POR_ROL, se pasa aparte
 * porque lib/perfil.ts no carga en el navegador) con el globo abierto
 * (?avisos=1), donde también se responde.
 */
export function urlAviso(rol: Rol, ordenId: string, aterrizaje: string, tipo?: TipoAviso): string {
  if (puedeEntrarA(rol, "taller")) return tipo && !esDelCliente(tipo) ? `/orden/${ordenId}` : `/orden/${ordenId}#mensajes`;
  return `${aterrizaje}?avisos=1`;
}

/** Los roles que ven el globo: los que atienden órdenes. El cajero no. */
export function veAvisos(rol: Rol): boolean {
  return puede(rol, "ver_ordenes") || puede(rol, "diagnosticar");
}

/** applicationServerKey de PushManager.subscribe: la llave VAPID pública viene en base64url. */
export function base64UrlABytes(base64Url: string): Uint8Array {
  const relleno = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
