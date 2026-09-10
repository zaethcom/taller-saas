/**
 * A dónde se mandan los bytes ya construidos. Recomendación del plano:
 * comprar las impresoras con Ethernet o WiFi -- el puerto 9100 (raw /
 * JetDirect) es el estándar de facto y lo hablan tanto ESC/POS como ZPL.
 *
 * Si alguna impresora concreta solo tiene USB, se conecta por USB-OTG al
 * Android de la estación y se implementa un DestinoUsb aparte con la
 * misma interfaz -- ninguna plantilla ni el bucle de estacion/index.ts
 * necesita saber cuál se está usando.
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
 * Config de las impresoras de una sede. Vive en config.json, nunca en
 * código -- así reemplazar una impresora es editar un archivo, no
 * reinstalar la estación.
 */
export interface ConfigImpresoras {
  tickets: { host: string; puerto?: number };
  etiquetas: { host: string; puerto?: number };
}

export function crearDestinos(config: ConfigImpresoras): {
  tickets: Destino;
  etiquetas: Destino;
} {
  return {
    tickets: new DestinoRed(config.tickets.host, config.tickets.puerto),
    etiquetas: new DestinoRed(config.etiquetas.host, config.etiquetas.puerto),
  };
}
