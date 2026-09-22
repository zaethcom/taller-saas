/**
 * Prueba mínima del buzzer (escpos.ts:pitido) contra la T20II real, a
 * través del puente Android (puerto 9100). Comando `ESC 07 n1 n2 n3` --
 * SIN CONFIRMAR todavía (ver el comentario de cabecera de `pitido()` en
 * escpos.ts): no es un comando estándar de Epson, es el que suelen
 * traer los clones chinos genéricos. Si esta impresora no tiene buzzer
 * o no entiende el comando, lo más probable es que no pase nada (ni
 * error ni pitido) -- no hay forma de saberlo sin probar en el papel
 * real.
 */
import { componer, inicializar, pitido, texto, salto, cortar } from "./escpos";
import { DestinoPuenteAndroid } from "./destino";

const buffer = componer(
  inicializar(),
  texto("PRUEBA DE PITIDO"),
  salto(2),
  pitido(3, 200, 200), // 3 pitidos cortos
  salto(2),
  cortar(),
);

console.log(`Enviando prueba de pitido (${buffer.length} bytes)`);

const t20ii = new DestinoPuenteAndroid("192.168.20.89", 9100);

t20ii
  .enviar(buffer)
  .then(() =>
    console.log(
      "OK: el puente confirmó la impresión. ¿Sonaron 3 pitidos cortos al terminar? Si no sonó nada, esta impresora no tiene buzzer o no entiende ESC 07 -- avisá y lo sacamos de index.ts.",
    ),
  )
  .catch((err) => console.error("ERROR:", err.message));
