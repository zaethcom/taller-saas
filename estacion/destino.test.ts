import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { DestinoPuenteAndroid, DestinoRed, MAX_PAYLOAD_PUENTE } from "./destino";

let servidor: Server | undefined;

afterEach(() => {
  servidor?.close();
  servidor = undefined;
});

function escucharEnPuertoLibre(manejarConexion: Parameters<typeof createServer>[0]): Promise<number> {
  return new Promise((resolve) => {
    servidor = createServer(manejarConexion);
    servidor.listen(0, "127.0.0.1", () => {
      const direccion = servidor!.address();
      resolve(typeof direccion === "object" && direccion ? direccion.port : 0);
    });
  });
}

describe("DestinoRed", () => {
  it("manda los bytes tal cual, sin ninguna cabecera", async () => {
    const recibido: Buffer[] = [];
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", (chunk) => recibido.push(chunk));
      socket.on("end", () => socket.end());
    });

    await new DestinoRed("127.0.0.1", puerto).enviar(Buffer.from([0x1b, 0x40, 0x41]));

    expect(Buffer.concat(recibido)).toEqual(Buffer.from([0x1b, 0x40, 0x41]));
  });
});

describe("DestinoPuenteAndroid", () => {
  it("antepone 4 bytes de longitud (big-endian) al payload", async () => {
    const recibido: Buffer[] = [];
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", (chunk) => {
        recibido.push(chunk);
        socket.end("OK\n");
      });
    });

    const payload = Buffer.from("hola");
    await new DestinoPuenteAndroid("127.0.0.1", puerto).enviar(payload);

    const enviado = Buffer.concat(recibido);
    expect(enviado.readInt32BE(0)).toBe(payload.length);
    expect(enviado.subarray(4)).toEqual(payload);
  });

  it("resuelve cuando el puente responde OK", async () => {
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", () => socket.end("OK\n"));
    });

    await expect(new DestinoPuenteAndroid("127.0.0.1", puerto).enviar(Buffer.from("x"))).resolves.toBeUndefined();
  });

  it("rechaza con el mensaje real cuando el puente responde ERR", async () => {
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", () => socket.end("ERR:impresora sin papel\n"));
    });

    await expect(new DestinoPuenteAndroid("127.0.0.1", puerto).enviar(Buffer.from("x"))).rejects.toThrow(
      "impresora sin papel",
    );
  });

  it("rechaza si el puente cierra sin responder nada", async () => {
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", () => socket.end());
    });

    await expect(new DestinoPuenteAndroid("127.0.0.1", puerto).enviar(Buffer.from("x"))).rejects.toThrow(
      "no confirmó la impresión",
    );
  });

  it("con token, manda primero la trama del token y después la del payload", async () => {
    const recibido: Buffer[] = [];
    const puerto = await escucharEnPuertoLibre((socket) => {
      socket.on("data", (chunk) => {
        recibido.push(chunk);
        const todo = Buffer.concat(recibido);
        if (todo.length >= 4 + 7 + 4 + 4) socket.end("OK\n");
      });
    });

    await new DestinoPuenteAndroid("127.0.0.1", puerto, 15000, "secreto").enviar(Buffer.from("hola"));

    const enviado = Buffer.concat(recibido);
    expect(enviado.readInt32BE(0)).toBe(7);
    expect(enviado.subarray(4, 11).toString()).toBe("secreto");
    expect(enviado.readInt32BE(11)).toBe(4);
    expect(enviado.subarray(15).toString()).toBe("hola");
  });

  it("no manda un trabajo más grande de lo que acepta el puente", async () => {
    await expect(
      new DestinoPuenteAndroid("127.0.0.1", 1).enviar(Buffer.alloc(MAX_PAYLOAD_PUENTE + 1)),
    ).rejects.toThrow("acepta hasta 512 KB");
  });
});
