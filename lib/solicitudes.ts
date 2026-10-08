/**
 * La máquina de estados de una solicitud de repuesto.
 *
 * Nace de un hueco real: hasta ahora un técnico sin existencia en su sede
 * solo tenía dos caminos, consumir o marcar faltante -- y "faltante"
 * significa comprar. No había forma de decir "esto sí lo hay, pero está en
 * el almacén de la otra sede", que es el caso normal cuando el inventario
 * a granel vive en un local y las reparaciones ocurren en el otro.
 *
 * El ciclo empieza antes que compras:
 *
 *   pedido_a_sede ─┬─► en_traslado ──► recibido ──► consumido
 *                  └─► faltante ──┬──► solicitado ──► recibido
 *                                 └──► recibido
 *
 * La bifurcación la decide una persona en el almacén, no la existencia:
 * el número puede no coincidir con el estante, y comprometer una compra
 * merece que alguien mire antes.
 *
 * Misma regla que lib/estados.ts: si una transición no está en
 * TRANSICIONES, no existe. Ninguna ruta debe escribir `estado = 'x'` por
 * su cuenta -- todo pasa por transicionar().
 */

export type EstadoSolicitud =
  /** El taller lo pidió al almacén. Todavía nadie sabe si hay. */
  | "pedido_a_sede"
  /** El almacén lo despachó: hay un traslado en camino. */
  | "en_traslado"
  /** Nadie lo tiene. Cae en compras. */
  | "faltante"
  /** Compras se lo pidió a un proveedor. */
  | "solicitado"
  /** Llegó, esté donde esté: por traslado o por compra. */
  | "recibido"
  /** Se usó en la orden. Fin. */
  | "consumido";

export const TRANSICIONES_SOLICITUD: Record<EstadoSolicitud, EstadoSolicitud[]> = {
  pedido_a_sede: ["en_traslado", "faltante"],
  en_traslado: ["recibido"],
  // faltante -> recibido directo es el camino que /compras ya usaba antes
  // de que existieran las solicitudes entre sedes: se conserva.
  faltante: ["solicitado", "recibido"],
  solicitado: ["recibido"],
  recibido: ["consumido"],
  consumido: [],
};

export const ESTADOS_FINALES_SOLICITUD: EstadoSolicitud[] = ["consumido"];

export class TransicionSolicitudInvalidaError extends Error {
  constructor(
    readonly desde: EstadoSolicitud,
    readonly hacia: EstadoSolicitud,
  ) {
    super(`una solicitud en '${desde}' no puede pasar a '${hacia}'`);
    this.name = "TransicionSolicitudInvalidaError";
  }
}

export function puedeTransicionarSolicitud(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
): boolean {
  return TRANSICIONES_SOLICITUD[desde]?.includes(hacia) ?? false;
}

export function esFinalSolicitud(estado: EstadoSolicitud): boolean {
  return ESTADOS_FINALES_SOLICITUD.includes(estado);
}

/** Devuelve el estado nuevo, o lanza si la transición no existe. */
export function transicionarSolicitud(
  desde: EstadoSolicitud,
  hacia: EstadoSolicitud,
): EstadoSolicitud {
  if (!puedeTransicionarSolicitud(desde, hacia)) {
    throw new TransicionSolicitudInvalidaError(desde, hacia);
  }
  return hacia;
}

/**
 * Los estados en los que una solicitud sigue esperando algo de alguien.
 * Es lo que las bandejas listan: ni las consumidas ni las ya recibidas
 * necesitan que nadie actúe.
 */
export const ESTADOS_ABIERTOS: EstadoSolicitud[] = [
  "pedido_a_sede",
  "en_traslado",
  "faltante",
  "solicitado",
];

export function estaAbierta(estado: EstadoSolicitud): boolean {
  return ESTADOS_ABIERTOS.includes(estado);
}
