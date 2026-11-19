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
import type { AjustesEtiquetadora } from "./ajustes-etiquetadora";

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
/** Lo máximo que acepta el puente (Tramas.MAX_PAYLOAD en zaethcom/puente). */
export const MAX_PAYLOAD_PUENTE = 512 * 1024;

function trama(datos: Buffer): Buffer {
  const cabecera = Buffer.alloc(4);
  cabecera.writeInt32BE(datos.length, 0);
  return Buffer.concat([cabecera, datos]);
}

/**
 * Con `token` (el que muestra la app del puente en «Acceso por red»), la
 * conexión empieza con una trama extra con el token y después va la del
 * payload. Sin token, una sola trama, como siempre. El puente con token
 * rechaza a quien no lo mande; uno sin token imprimiría el token como si
 * fuera el ticket, así que poner `tokenPuente` en config.json solo
 * después de configurarlo en la app.
 */
export class DestinoPuenteAndroid implements Destino {
  constructor(
    private readonly host: string,
    private readonly puerto = 9100,
    private readonly timeoutMs = 15000,
    private readonly token?: string,
  ) {}

  enviar(datos: Buffer | string): Promise<void> {
    return new Promise((resolve, reject) => {
      const payload = typeof datos === "string" ? Buffer.from(datos, "ascii") : datos;
      if (payload.length > MAX_PAYLOAD_PUENTE) {
        reject(
          new Error(
            `el trabajo pesa ${Math.round(payload.length / 1024)} KB y el puente acepta hasta ${MAX_PAYLOAD_PUENTE / 1024} KB`,
          ),
        );
        return;
      }
      const socket = new Socket();

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
        const tramas = this.token ? [trama(Buffer.from(this.token, "utf-8")), trama(payload)] : [trama(payload)];
        socket.write(Buffer.concat(tramas));
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
  /** Solo para la de etiquetas: Argox habla "pplb" (por defecto), Zebra "zpl". */
  lenguaje?: LenguajeEtiquetas;
  /** Solo para la de etiquetas: oscuridad, velocidad, avance… (ver ajustes-etiquetadora.ts). */
  ajustes?: AjustesEtiquetadora;
}

/** "escpos": no hay etiquetadora; las etiquetas salen por la POS de tickets. */
export type LenguajeEtiquetas = "pplb" | "zpl" | "escpos";

export interface ConfigImpresoras {
  tickets: ConfigImpresora;
  etiquetas: ConfigImpresora;
}

function crearDestino(config: ConfigImpresora, tokenPuente?: string): Destino {
  return config.protocolo === "puente_android"
    ? new DestinoPuenteAndroid(config.host, config.puerto, undefined, tokenPuente)
    : new DestinoRed(config.host, config.puerto);
}

/** `tokenPuente` sale de config.json, nunca de la web: no viaja por /api/estacion/impresoras. */
export function crearDestinos(
  config: ConfigImpresoras,
  tokenPuente?: string,
): {
  tickets: Destino;
  etiquetas: Destino;
} {
  return {
    tickets: crearDestino(config.tickets, tokenPuente),
    etiquetas: crearDestino(config.etiquetas, tokenPuente),
  };
}
