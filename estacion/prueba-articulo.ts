/**
 * Prueba real de la etiqueta de artículo individualizado (marca/modelo
 * + código de barras 1D) contra la Argox real.
 */
import { DestinoPuenteAndroid } from "./destino";
import { etiquetaArticuloPplb } from "./etiqueta";

const etiquetas = new DestinoPuenteAndroid("192.168.20.89", 9101);

const pplb = etiquetaArticuloPplb({
  codigo: "ART-000123",
  tipo: "patineta",
  marca: "Xiaomi",
  modelo: "Pro 2",
});

console.log("Enviando etiqueta de articulo (marca/modelo + codigo de barras):\n" + pplb);

etiquetas
  .enviar(pplb)
  .then(() => console.log("OK: confirmada por el puente."))
  .catch((e) => console.error("ERROR:", e.message));
