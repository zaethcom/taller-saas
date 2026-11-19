import { describe, expect, it, vi } from "vitest";
import {
  estadoConexion,
  intervaloPrueba,
  probarServidor,
  REINTENTO_CON_CONEXION_MS,
  REINTENTO_SIN_CONEXION_MS,
} from "../lib/sin-conexion/conexion";
import {
  guardarEventoInstalar,
  instalarApp,
  marcarInstalada,
  sePuedeInstalar,
  suscribirInstalar,
  type EventoInstalar,
} from "../lib/sin-conexion/instalar";

describe("estadoConexion", () => {
  it("sin red en el navegador es sin conexión aunque no se haya probado", () => {
    expect(estadoConexion(false, null)).toBe("sin_conexion");
    expect(estadoConexion(false, true)).toBe("sin_conexion");
  });
  it("con red pero el servidor no responde es sin conexión", () => {
    expect(estadoConexion(true, false)).toBe("sin_conexion");
  });
  it("con red y sin prueba todavía se asume en línea", () => {
    expect(estadoConexion(true, null)).toBe("en_linea");
    expect(estadoConexion(true, true)).toBe("en_linea");
  });
  it("prueba más seguido cuando no hay conexión", () => {
    expect(intervaloPrueba("sin_conexion")).toBe(REINTENTO_SIN_CONEXION_MS);
    expect(intervaloPrueba("en_linea")).toBe(REINTENTO_CON_CONEXION_MS);
    expect(REINTENTO_SIN_CONEXION_MS).toBeLessThan(REINTENTO_CON_CONEXION_MS);
  });
});

describe("probarServidor", () => {
  it("true con respuesta ok", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true });
    expect(await probarServidor(f as unknown as typeof fetch)).toBe(true);
    expect(f.mock.calls[0]?.[0]).toBe("/api/app/conexion");
  });
  it("false si la petición falla o responde error", async () => {
    expect(await probarServidor(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch)).toBe(false);
    expect(await probarServidor(vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch)).toBe(false);
  });
});

function eventoFalso(outcome: "accepted" | "dismissed") {
  return {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  } as unknown as EventoInstalar;
}

describe("instalar app", () => {
  it("sin evento del navegador no se puede instalar", async () => {
    marcarInstalada();
    expect(sePuedeInstalar()).toBe(false);
    expect(await instalarApp()).toBe(false);
  });
  it("avisa a los suscritos y usa el evento una sola vez", async () => {
    const oyente = vi.fn();
    const quitar = suscribirInstalar(oyente);
    const evento = eventoFalso("accepted");
    guardarEventoInstalar(evento);
    expect(oyente).toHaveBeenLastCalledWith(true);
    expect(await instalarApp()).toBe(true);
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(oyente).toHaveBeenLastCalledWith(false);
    expect(sePuedeInstalar()).toBe(false);
    quitar();
  });
  it("si la persona cancela devuelve false", async () => {
    guardarEventoInstalar(eventoFalso("dismissed"));
    expect(await instalarApp()).toBe(false);
  });
});

describe("pantallas sin internet", () => {
  it("guarda solo las pantallas de mostrador y taller", async () => {
    const { debeGuardarPagina } = await import("../lib/sin-conexion/paginas");
    expect(debeGuardarPagina("/vender")).toBe(true);
    expect(debeGuardarPagina("/orden/abc/cotizacion")).toBe(true);
    expect(debeGuardarPagina("/vendedores")).toBe(false);
    expect(debeGuardarPagina("/configuracion")).toBe(false);
    expect(debeGuardarPagina("/login")).toBe(false);
    expect(debeGuardarPagina("/seguimiento/x")).toBe(false);
    expect(debeGuardarPagina("/")).toBe(true);
  });

  it("baja de antemano solo las pantallas de las puertas del rol, todas guardables", async () => {
    const { pantallasParaPrecargar, debeGuardarPagina } = await import("../lib/sin-conexion/paginas");
    const cajero = pantallasParaPrecargar({ pos: true, taller: false });
    expect(cajero).toEqual(expect.arrayContaining(["/", "/vender", "/recibir", "/entregar", "/turno"]));
    expect(cajero).not.toContain("/escanear");
    expect(pantallasParaPrecargar({ pos: false, taller: true })).toEqual(["/", "/escanear"]);
    for (const p of pantallasParaPrecargar({ pos: true, taller: true })) expect(debeGuardarPagina(p)).toBe(true);
  });

  it("el service worker encuentra el código de una pantalla en su HTML y en el CSS", async () => {
    const { readFileSync } = await import("node:fs");
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    const fuente = sw.match(/const RE_ESTATICO = [^\n]+\n\nfunction rutasEstaticas[\s\S]*?\n}\n/);
    expect(fuente).not.toBeNull();
    const rutasEstaticas = new Function(`${fuente![0]}; return rutasEstaticas;`)() as (t: string) => Set<string>;
    const html =
      '<script src="/_next/static/chunks/app/(pos)/recibir/page-ab12.js?dpl=x" async></script>' +
      'self.__next_f.push([1,"3:I[1,[\\"static/chunks/45-ff.js\\",\\"static/chunks/app/(pos)/layout-9.js\\"]"])' +
      "src:url(/_next/static/media/a.woff2) format('woff2')";
    expect([...rutasEstaticas(html)]).toEqual([
      "/_next/static/chunks/app/(pos)/recibir/page-ab12.js?dpl=x",
      "/_next/static/chunks/45-ff.js",
      "/_next/static/chunks/app/(pos)/layout-9.js",
      "/_next/static/media/a.woff2",
    ]);
  });

  it("public/sw.js usa la misma lista y el mismo nombre de caché", async () => {
    const { readFileSync } = await import("node:fs");
    const { PAGINAS_SIN_CONEXION } = await import("../lib/sin-conexion/paginas");
    const { CACHE_PAGINAS } = await import("../lib/sin-conexion/borrar-copia");
    const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    const lista = sw.match(/const PAGINAS_SIN_CONEXION = (\[[^\]]*\]);/);
    expect(lista).not.toBeNull();
    expect(JSON.parse(lista![1]!)).toEqual([...PAGINAS_SIN_CONEXION]);
    expect(sw).toContain(`const CACHE_PAGINAS = "${CACHE_PAGINAS}";`);
  });
});
