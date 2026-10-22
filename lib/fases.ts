/**
 * Las subfases de la orden (0050_fase_orden.sql) se ocultaron con los
 * estados simples (0065_estados_simples.sql): casi no se usaban y
 * llenaban la ficha. La tabla y los datos siguen en la base; de ellas
 * solo queda leer el historial que ya las nombra.
 */
import { etiquetaEstado } from "./estados";

/**
 * Cómo se lee una fila de orden_evento en un historial: un cambio de
 * estado muestra el estado (y la fase con que arrancó, si hay); un
 * cambio de fase dentro del mismo estado muestra solo la fase.
 */
export function etiquetaEvento(e: { de_estado: string | null; a_estado: string; a_fase: string | null }): string {
  const estado = etiquetaEstado(e.a_estado);
  if (e.de_estado === e.a_estado) {
    return e.a_fase ? `${estado} · ${e.a_fase}` : estado;
  }
  return e.a_fase ? `${estado} · ${e.a_fase}` : estado;
}
