/**
 * A dónde se mandan los bytes ya construidos. Recomendación del plano:
 * comprar las impresoras con Ethernet o WiFi -- el puerto 9100 (raw /
 * JetDirect) es el estándar de facto y lo hablan tanto ESC/POS como ZPL.
 *
 * Cuando la impresora real solo tiene USB (caso real: Polaco Scooter),
 * no hace falta escribir un DestinoUsb en Node -- ya existe una app
 * Android (github.com/zaethcom/smart-food-label, `PrintServer.kt`) que
 * corre en el dispositivo con la impresora conectada por USB, escucha
 * en red y reenvía los bytes tal cual por USB. `DestinoPuenteAndroid`
 * es el cliente de ESE protocolo -- distinto del raw/JetDirect de
 * `DestinoRed`, aunque las dos convivan en el mismo puerto 9100 por
 * convención: 4 bytes de longitud (entero de 32 bits, big-endian) +
 * el payload, y una línea de respuesta "OK" o "ERR:<mensaje>". No
 * confundir los dos protocolos -- mandarle a una impresora de red de
 * verdad esos 4 bytes de más rompe la impresión.
 */
import { Socket } from "node:net";

export interface Destino {
  enviar(datos: Buffer | string): Promise<void>;
}

export class DestinoRed implements Destino {
  constructor(
    private readonly host: string,
    private readonly puerto = 9100,
    private readonly timeoutMs = 5000,
  ) {}

  enviar(datos: Buffer | string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const buffer = typeof datos === "string" ? Buffer.from(datos, "ascii") : datos;

      socket.setTimeout(this.timeoutMs);

      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error(`Tiempo de espera agotado conectando a ${this.host}:${this.puerto}`));
      });

      socket.once("error", (err) => {
        reject(err);
      });

      socket.connect(this.puerto, this.host, () => {
        socket.write(buffer, (err) => {
          if (err) {
            reject(err);
            return;
          }
          socket.end();
        });
      });

      socket.once("close", () => resolve());
    });
  }
}

/**
 * Cliente del protocolo de `PrintServer.kt` (smart-food-label): un
 * dispositivo Android con la impresora USB conectada de verdad, que
 * reenvía RAW lo que reciba -- no reinterpreta PPLB/ZPL/ESC-POS, así
 * que el payload que le llega debe ser exactamente el que ya generó
 * la plantilla correspondiente, igual que con DestinoRed.
 */
export class DestinoPuenteAndroid implements Destino {
  constructor(
    private readonly host: string,
    private readonly puerto = 9100,
    private readonly timeoutMs = 15000,
  ) {}

  enviar(datos: Buffer | string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const payload = typeof datos === "string" ? Buffer.from(datos, "ascii") : datos;
      const cabecera = Buffer.alloc(4);
      cabecera.writeInt32BE(payload.length, 0);

      let respuesta = "";

      socket.setTimeout(this.timeoutMs);

      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error(`Tiempo de espera agotado hablando con el puente Android en ${this.host}:${this.puerto}`));
      });

      socket.once("error", (err) => {
        reject(err);
      });

      socket.on("data", (chunk) => {
        respuesta += chunk.toString("utf-8");
      });

      socket.connect(this.puerto, this.host, () => {
        socket.write(Buffer.concat([cabecera, payload]));
      });

      socket.once("close", () => {
        const linea = respuesta.split("\n")[0]?.trim() ?? "";
        if (linea.startsWith("OK")) {
          resolve();
        } else {
          reject(
            new Error(
              linea.startsWith("ERR:")
                ? linea.slice("ERR:".length)
                : `el puente Android en ${this.host}:${this.puerto} no confirmó la impresión`,
            ),
          );
        }
      });
    });
  }
}

/**
 * Config de las impresoras de una sede. Vive en config.json, nunca en
 * código -- así reemplazar una impresora es editar un archivo, no
 * reinstalar la estación. `protocolo` es "crudo" por defecto (impresora
 * de red de verdad, hablando raw/JetDirect) -- "puente_android" es para
 * cuando del otro lado del puerto 9100 hay un celular/BlissOS corriendo
 * smart-food-label con la impresora por USB, no la impresora misma.
 */
export interface ConfigImpresora {
  host: string;
  puerto?: number;
  protocolo?: "crudo" | "puente_android";
}

/**
 * `etiquetas` es opcional a propósito: la sede tiene una sola impresora
 * y las etiquetas salen por la de tickets (ver estacion/etiqueta.ts).
 * Solo hay que ponerla si de verdad hay una etiquetadora aparte.
 */
export interface ConfigImpresoras {
  tickets: ConfigImpresora;
  etiquetas?: ConfigImpresora;
}

function crearDestino(config: ConfigImpresora): Destino {
  return config.protocolo === "puente_android"
    ? new DestinoPuenteAndroid(config.host, config.puerto)
    : new DestinoRed(config.host, config.puerto);
}

export function crearDestinos(config: ConfigImpresoras): {
  tickets: Destino;
  etiquetas: Destino;
} {
  const tickets = crearDestino(config.tickets);

  // Sin etiquetadora configurada las dos salidas son la misma impresora.
  // Que el destino exista igual evita que un trabajo mal ruteado se caiga
  // con "undefined": imprime en la de tickets, que es lo correcto hoy.
  return {
    tickets,
    etiquetas: config.etiquetas ? crearDestino(config.etiquetas) : tickets,
  };
}
