/**
 * Prueba mínima del QR ESC/POS (escpos.ts:qr) contra la T20II real, a
 * través del puente Android (puerto 9100). Aislado del comprobante
 * completo (a diferencia de prueba-t20ii.ts) para confirmar solo el
 * comando GS ( k -- si esto sale ilegible o no imprime nada, el
 * problema está en qr() y no en el resto de la plantilla.
 */
import { alinear, componer, cortar, inicializar, qr, salto, texto } from "./escpos";
import { DestinoPuenteAndroid } from "./destino";

const contenido = "https://taller-saas-mvp.vercel.app/seguimiento/prueba-impresion";

const buffer = componer(
  inicializar(),
  alinear("centro"),
  texto("PRUEBA QR"),
  salto(2),
  qr(contenido),
  salto(),
  texto(contenido),
  salto(3),
  cortar(),
);

console.log(`Enviando QR de prueba (${buffer.length} bytes) con contenido:\n${contenido}`);

const t20ii = new DestinoPuenteAndroid("192.168.20.89", 9100);

t20ii
  .enviar(buffer)
  .then(() => console.log("OK: el puente confirmó la impresión. Escanea el QR para verificar que decodifica bien."))
  .catch((err) => console.error("ERROR:", err.message));
