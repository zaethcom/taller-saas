import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { generarClaveEstacion, hashClave } from "../lib/estacion-auth";

/**
 * El fallo que estas pruebas existen para impedir no da ningún error: si
 * quien CREA la credencial guarda un hash distinto del que compara quien
 * la VERIFICA, la estación se autentica mal para siempre y lo único que
 * se ve es un 401 sin explicación desde el equipo de la sede.
 */
describe("hashClave", () => {
  it("es sha256 en hexadecimal, que es lo que espera verificar_clave_estacion", () => {
    // El mismo cálculo que hace la función de 0006 del lado de Postgres:
    // encode(sha256('...'::bytea), 'hex').
    expect(hashClave("clave-de-prueba")).toBe(
      createHash("sha256").update("clave-de-prueba").digest("hex"),
    );
  });

  it("devuelve 64 caracteres hexadecimales en minúscula", () => {
    expect(hashClave(generarClaveEstacion())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dos claves distintas no comparten hash", () => {
    expect(hashClave("una")).not.toBe(hashClave("otra"));
  });
});

describe("generarClaveEstacion", () => {
  it("viaja entera por una URL, un JSON y un header sin escapar nada", () => {
    // base64url: sin '+', '/' ni '='. Un '+' en un header Authorization o
    // en un config.json copiado a mano es justo lo que se pierde por el
    // camino y deja una clave que "se ve bien" y no valida.
    for (let i = 0; i < 50; i++) {
      expect(generarClaveEstacion()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("tiene los 32 bytes de aleatoriedad que dice tener", () => {
    // 32 bytes en base64 sin relleno son 43 caracteres.
    expect(generarClaveEstacion()).toHaveLength(43);
  });

  it("no se repite", () => {
    const vistas = new Set(Array.from({ length: 200 }, () => generarClaveEstacion()));
    expect(vistas.size).toBe(200);
  });
});
