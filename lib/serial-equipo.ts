/**
 * Serial para un equipo que llega sin uno legible (o que quien recibe
 * no quiere copiar): la recepción lo deja vacío y se genera al guardar.
 *
 * `EQ-` + 6 letras/números sin los que se confunden al leerlos en voz
 * alta o en una etiqueta (0/O, 1/I/L). Único por empresa lo garantiza
 * la base (`unique (empresa_id, serial)`); quien lo usa reintenta si
 * choca, que con ~887 millones de combinaciones es casi imposible.
 */
import { randomInt } from "crypto";

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generarSerialEquipo(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `EQ-${s}`;
}
