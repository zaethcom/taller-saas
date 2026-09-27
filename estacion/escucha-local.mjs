/**
 * Oyente TCP falso para probar localmente, sin impresora real: recibe
 * en el puerto que le pasen los mismos bytes que DestinoRed.enviar()
 * mandaría a una impresora de verdad, y los vuelca a la consola (texto)
 * y a un archivo (crudo) para poder revisarlos con calma.
 *
 * Uso: node estacion/escucha-local.mjs <puerto> <archivo-salida>
 */
import { createServer } from "node:net";
import { appendFileSync, writeFileSync } from "node:fs";

const puerto = Number(process.argv[2] ?? 9100);
const archivo = process.argv[3] ?? "estacion/salida-local.txt";
const archivoCrudo = archivo.replace(/\.txt$/, ".raw");

writeFileSync(archivo, "");
writeFileSync(archivoCrudo, "");

let contador = 0;

const servidor = createServer((socket) => {
  const partes = [];
  socket.on("data", (chunk) => partes.push(chunk));
  socket.on("end", () => {
    const datos = Buffer.concat(partes);
    contador += 1;
    console.log(`\n--- conexión recibida en :${puerto} (${datos.length} bytes) ---`);
    // latin1 (no utf-8): son bytes CP437/latin1 en ESC/POS, texto plano
    // en ZPL -- convertir a utf-8 corrompe cualquier acento/ñ.
    console.log(datos.toString("latin1"));
    appendFileSync(archivo, `\n=== ${new Date().toISOString()} (${datos.length} bytes) ===\n${datos.toString("latin1")}\n`);
    // Los bytes crudos, sin decodificar nada -- para inspeccionar con
    // xxd/hexdump si alguna vez hace falta ver el byte exacto.
    appendFileSync(archivoCrudo, Buffer.concat([Buffer.from(`\n=== envio ${contador} (${datos.length} bytes) ===\n`), datos, Buffer.from("\n")]));
  });
});

servidor.listen(puerto, "127.0.0.1", () => {
  console.log(`[oyente] escuchando en 127.0.0.1:${puerto}, guardando en ${archivo}`);
});
