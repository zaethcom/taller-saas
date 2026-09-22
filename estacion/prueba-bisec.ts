/**
 * Se cambió el rollo de etiquetas -- todo lo confirmado antes (tamaño,
 * rotación, coordenadas) puede no aplicar al papel nuevo. Empezar de
 * cero con la prueba más simple posible, sin asumir nada.
 */
import { DestinoPuenteAndroid } from "./destino";

const etiquetas = new DestinoPuenteAndroid("192.168.20.89", 9101);

const pplb = ["N", 'A20,20,0,3,1,1,N,"PRUEBA ETIQUETA NUEVA"', "P1"].join("\r\n");

console.log("Enviando:\n" + pplb);

etiquetas
  .enviar(pplb)
  .then(() => console.log("OK: el puente confirmó la impresión."))
  .catch((err) => console.error("ERROR:", err.message));
