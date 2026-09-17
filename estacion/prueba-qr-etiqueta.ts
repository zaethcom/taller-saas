/**
 * Prueba del comando `b` (2D bar code, tipo Q=QR) de PPLB contra la
 * Argox SAT-TT448USP real, puerto de etiquetas (9101). La primera
 * ronda (URL completa, escala por defecto) salió pero el celular
 * reportó "enlace inválido" -- la etiqueta real es de 30x25mm (3
 * columnas por rollo), demasiado chica para un QR de ~65 caracteres a
 * escala 3: se corta contra el borde físico y decodifica corrupto.
 * La ronda siguiente probó el código de entrada (mucho más corto) y
 * escala 2, cerca del origen (X=5) -- confirmado en foto: entra
 * completo y el texto se lee, en la columna izquierda del rollo.
 *
 * Esta ronda decide imprimir de a una etiqueta por vez (no las tres
 * columnas a la vez -- ver conversación), pero usando la columna del
 * CENTRO para la prueba en vez de la izquierda. OFFSET_X está
 * calculado, no confirmado: 30mm de ancho por columna a 8 dots/mm
 * (203dpi, el valor típico de esta familia de impresoras, pero sin
 * confirmar en esta unidad) da ~240 dots por columna, más el mismo
 * margen de 5 que usó la ronda de la izquierda. Si sale corrido hacia
 * la izquierda o la derecha dentro de la celda del centro, ajustar
 * este número y volver a probar -- no hay forma de calcularlo exacto
 * sin la ficha técnica real de la impresora.
 */
import { DestinoPuenteAndroid } from "./destino";

const etiquetas = new DestinoPuenteAndroid("192.168.20.89", 9101);

const contenido = "PS000123";
const OFFSET_X = 245; // columna centro -- estimado, ver comentario de cabecera

const pplb =
  ["N", `b${OFFSET_X},5,Q,s2,"${contenido}"`, `A${OFFSET_X},120,0,3,1,1,N,"${contenido}"`, "P1"].join(
    "\r\n",
  ) + "\r\n";

console.log("Enviando:\n" + pplb);

etiquetas
  .enviar(pplb)
  .then(() =>
    console.log(
      "OK: el puente confirmó la impresión. Revisa si cayó en la columna del CENTRO (si sale en la izquierda o a caballo entre dos, ajustar OFFSET_X) y si el QR decodifica bien.",
    ),
  )
  .catch((err) => console.error("ERROR:", err.message));
