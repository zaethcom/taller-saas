/**
 * Prueba mínima de PPLB contra la Argox SAT-TT448USP real, a través del
 * puente Android (protocolo con prefijo de 4 bytes + confirmación
 * OK/ERR). Manda solo texto -- sin redeclarar tamaño de etiqueta
 * (Q/q), confiando en que la impresora ya tiene esa calibración de la
 * prueba que ya funcionó desde la propia app del puente.
 */
import { DestinoPuenteAndroid } from "./destino";

const etiquetas = new DestinoPuenteAndroid("192.168.20.89", 9101);

const pplb = ["N", 'A50,50,0,3,1,1,N,"PRUEBA PPLB CLAUDE"', "P1"].join("\r\n") + "\r\n";

console.log("Enviando:\n" + pplb);

etiquetas
  .enviar(pplb)
  .then(() => console.log("OK: el puente confirmó la impresión."))
  .catch((err) => console.error("ERROR:", err.message));
