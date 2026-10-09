/**
 * El código corto con el que la app Android del puente se vincula a una
 * sede (ver supabase/migrations/0049_codigo_vinculacion.sql).
 *
 * 8 caracteres de un alfabeto sin los que se confunden al leerlos en una
 * pantalla y teclearlos en otra (0/O, 1/I/L), mostrados como XXXX-XXXX.
 * 32^8 combinaciones, 15 minutos y un solo uso: adivinarlo a ciegas no es
 * una opción real.
 */
import { randomInt } from "node:crypto";

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LARGO_CODIGO = 8;
export const VIGENCIA_CODIGO_MS = 15 * 60_000;

export function generarCodigoVinculacion(): string {
  let codigo = "";
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

/**
 * Lo que la persona escribió, llevado a la forma canónica: sin guion ni
 * espacios, en mayúsculas. Así "abcd efgh", "ABCD-EFGH" y "abcdefgh"
 * son el mismo código. null si no tiene forma de código.
 */
export function normalizarCodigo(entrada: string): string | null {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpio.length !== LARGO_CODIGO) return null;
  for (const c of limpio) {
    if (!ALFABETO.includes(c)) return null;
  }
  return limpio;
}
