import { describe, expect, it } from "vitest";
import { base64UrlABytes, notificacionDeAviso, recortarTexto, textoAviso, urlAviso, veAvisos } from "../lib/avisos";

describe("textoAviso", () => {
  it("el mensaje va tal cual, recortado", () => {
    expect(textoAviso("mensaje", "  ¿ya está listo?  ")).toBe("¿ya está listo?");
    expect(textoAviso("mensaje", "x".repeat(400))).toHaveLength(300);
  });

  it("el rechazo lleva el motivo si lo hay", () => {
    expect(textoAviso("cotizacion_rechazada", "muy caro")).toBe("El cliente rechazó la cotización. Motivo: muy caro");
    expect(textoAviso("cotizacion_rechazada", "")).toBe("El cliente rechazó la cotización.");
  });

  it("los costos adicionales nombran el ítem", () => {
    expect(textoAviso("item_aprobado", "Batería")).toBe("El cliente aprobó: Batería");
    expect(textoAviso("item_rechazado", null)).toBe("El cliente rechazó un costo adicional.");
  });
});

describe("recortarTexto", () => {
  it("termina en … cuando corta", () => {
    expect(recortarTexto("abcdef", 4)).toBe("abc…");
    expect(recortarTexto("abc", 4)).toBe("abc");
  });
});

describe("notificacionDeAviso", () => {
  it("un mensaje se titula con el cliente y la orden", () => {
    const n = notificacionDeAviso({
      tipo: "mensaje",
      texto: "hola",
      ordenId: "o1",
      numero: 12,
      cliente: "Ana",
      url: "/orden/o1#mensajes",
    });
    expect(n).toEqual({ titulo: "Ana escribió · Orden #12", cuerpo: "hola", url: "/orden/o1#mensajes", tag: "orden-o1" });
  });

  it("una aprobación se titula con lo que pasó", () => {
    const n = notificacionDeAviso({
      tipo: "cotizacion_aprobada",
      texto: "El cliente aprobó la cotización desde el enlace.",
      ordenId: "o1",
      numero: null,
      cliente: null,
      url: "/",
    });
    expect(n.titulo).toBe("Aprobó la cotización · Orden");
    expect(n.cuerpo).toBe("El cliente: El cliente aprobó la cotización desde el enlace.");
  });
});

describe("urlAviso", () => {
  it("quien entra al taller va a los mensajes de la orden", () => {
    expect(urlAviso("tecnico", "o1", "/escanear")).toBe("/orden/o1#mensajes");
    expect(urlAviso("admin", "o1", "/ordenes")).toBe("/orden/o1#mensajes");
  });

  it("recepción va a su inicio con el globo abierto", () => {
    expect(urlAviso("recepcion", "o1", "/vender")).toBe("/vender?avisos=1");
  });
});

describe("veAvisos", () => {
  it("el cajero no ve el globo; quienes atienden órdenes sí", () => {
    expect(veAvisos("cajero")).toBe(false);
    expect(["admin", "recepcion", "tecnico", "compras"].every((r) => veAvisos(r as never))).toBe(true);
  });
});

describe("base64UrlABytes", () => {
  it("decodifica base64url sin relleno", () => {
    expect([...base64UrlABytes("AQID_w")]).toEqual([1, 2, 3, 255]);
  });
});

describe("aviso de repuesto recibido", () => {
  it("dice qué llegó y que la orden puede seguir", () => {
    expect(textoAviso("repuesto_recibido", "Pantalla A10")).toBe("Llegó Pantalla A10. La orden está lista para seguir.");
  });

  it("la notificación no habla en nombre del cliente", () => {
    const n = notificacionDeAviso({
      tipo: "repuesto_recibido",
      texto: "Llegó Pantalla A10. La orden está lista para seguir.",
      ordenId: "o1",
      numero: 7,
      cliente: "Ana",
      url: "/orden/o1",
    });
    expect(n.titulo).toBe("Llegó el repuesto · Orden #7");
    expect(n.cuerpo).toBe("Llegó Pantalla A10. La orden está lista para seguir.");
  });

  it("el técnico va a la orden, no a los mensajes", () => {
    expect(urlAviso("tecnico", "o1", "/taller", "repuesto_recibido")).toBe("/orden/o1");
    expect(urlAviso("tecnico", "o1", "/taller", "mensaje")).toBe("/orden/o1#mensajes");
  });
});
