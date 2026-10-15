/**
 * Junta lo dictado con lo que ya estaba escrito en el campo: un espacio
 * (o salto de línea si lo anterior terminaba en uno) entre los dos, y la
 * primera letra en mayúscula si empieza una oración.
 */
export function unirDictado(actual: string, dictado: string): string {
  const nuevo = dictado.trim();
  if (!nuevo) return actual;
  const previo = actual.replace(/[ \t]+$/, "");
  const empiezaOracion = previo === "" || /[.!?\n]$/.test(previo);
  const texto = empiezaOracion ? nuevo.charAt(0).toUpperCase() + nuevo.slice(1) : nuevo;
  if (previo === "" || previo.endsWith("\n")) return previo + texto;
  return `${previo} ${texto}`;
}
