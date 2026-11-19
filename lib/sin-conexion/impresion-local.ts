/**
 * Imprimir recibos sin internet (plan sin internet, fase 5).
 *
 * Con internet los recibos van a la cola trabajo_impresion y los imprime
 * la estación de la sede. Sin conexión eso no llega, así que el recibo se
 * arma aquí, en el navegador, con las mismas plantillas de la estación
 * (estacion/plantillas/) y el encabezado de la sede guardado en la copia
 * local (/api/app/impresion-local), y se manda por USB a la impresora de
 * tickets que este navegador ya tiene permitida (Configuración →
 * Impresoras USB de este equipo, o /estacion). Funciona en Chrome o Edge
 * con la impresora conectada por cable al mismo equipo.
 *
 * Nunca lanza errores: devuelve qué pasó, para que la pantalla lo diga.
 */
import { Buffer as BufferNavegador } from "buffer";
import { reciboVenta, type CargaReciboVenta } from "../../estacion/plantillas/recibo";
import { comprobanteRecepcion, type CargaComprobanteRecepcion } from "../../estacion/plantillas/comprobante";
import { fechaHoraRecibo } from "../fecha-recibo";
import { imprimirUsb, impresoraConectada } from "../impresion-usb";
import { leerCopia } from "./copia-local";
import type { CargaMarcaEmpresa } from "../../estacion/marca";

// Las plantillas de la estación usan Buffer de Node; el navegador no lo trae.
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as { Buffer?: unknown }).Buffer = BufferNavegador;
}

export type ResultadoImpresionLocal = "impreso" | "sin_impresora" | "sin_datos" | "error";

export type ReciboLocal =
  | { tipo: "recibo_venta"; carga: Omit<CargaReciboVenta, keyof CargaMarcaEmpresa> }
  | { tipo: "comprobante_recepcion"; carga: Omit<CargaComprobanteRecepcion, keyof CargaMarcaEmpresa> };

/** Los bytes del recibo, con el encabezado de la sede y la fecha de ahora si no trae. */
export function bytesReciboLocal(recibo: ReciboLocal, marca: CargaMarcaEmpresa, ahora = new Date()): Uint8Array {
  const contenido =
    recibo.tipo === "recibo_venta"
      ? reciboVenta({ fecha: fechaHoraRecibo(ahora), ...recibo.carga, ...marca })
      : comprobanteRecepcion({ ...recibo.carga, ...marca });
  return new Uint8Array(contenido);
}

export async function imprimirReciboLocal(recibo: ReciboLocal): Promise<ResultadoImpresionLocal> {
  try {
    const copia = await leerCopia();
    const marca = copia?.impresion?.marca;
    if (!marca) return "sin_datos";
    const impresora = await impresoraConectada("tickets");
    if (!impresora) return "sin_impresora";
    await imprimirUsb(impresora, bytesReciboLocal(recibo, marca));
    return "impreso";
  } catch {
    return "error";
  }
}

/** Quién está cobrando, para el recibo (lo guarda la copia). */
export async function cajeroLocal(): Promise<string | null> {
  return (await leerCopia())?.impresion?.cajero ?? null;
}

/** Lo que se le dice a quien cobra según cómo salió la impresión. */
export function textoImpresionLocal(r: ResultadoImpresionLocal): string {
  switch (r) {
    case "impreso":
      return "El recibo se imprimió en la impresora USB de este equipo.";
    case "sin_impresora":
      return "Sin conexión no se imprime por la estación: conecta la impresora de tickets por USB a este equipo (Chrome o Edge) para imprimir sin internet.";
    case "sin_datos":
      return "Sin conexión no se pudo imprimir: este equipo todavía no tiene guardados los datos del recibo. Se guardan solos con internet.";
    case "error":
      return "No se pudo imprimir en la impresora USB de este equipo.";
  }
}
