import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/servidor", () => ({ clienteAdmin: vi.fn() }));

import { construirManifest, leerEmpresaDeUrl, parametrosEmpresa, tamanoIcono } from "../lib/icono-app";

describe("parametrosEmpresa", () => {
  it("prefiere la empresa de la sesión sobre el código de /login", () => {
    expect(parametrosEmpresa({ empresaId: "abc", codigo: "polaco" })).toBe("e=abc");
  });
  it("sin sesión usa el código", () => {
    expect(parametrosEmpresa({ empresaId: null, codigo: "polaco" })).toBe("c=polaco");
  });
  it("sin nada queda vacío", () => {
    expect(parametrosEmpresa({})).toBe("");
  });
});

describe("leerEmpresaDeUrl", () => {
  it("lee e y c, el código en minúsculas", () => {
    expect(leerEmpresaDeUrl(new URLSearchParams("c=Polaco"))).toEqual({ empresaId: null, codigo: "polaco" });
    expect(leerEmpresaDeUrl(new URLSearchParams("e=abc"))).toEqual({ empresaId: "abc", codigo: null });
  });
});

describe("construirManifest", () => {
  it("con logo, íconos PNG cuadrados de la empresa", () => {
    const m = construirManifest({ empresaId: "abc" }, true);
    expect(m.name).toBe("Taller 360");
    expect(m.icons).toEqual([
      { src: "/api/app/icono?e=abc&tam=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/app/icono?e=abc&tam=512", sizes: "512x512", type: "image/png", purpose: "any" },
    ]);
  });
  it("sin logo, el ícono genérico", () => {
    expect(construirManifest({ empresaId: "abc" }, false).icons[0]?.src).toBe("/icon.svg");
  });
  it("sin empresa, el ícono genérico aunque digan que hay logo", () => {
    expect(construirManifest({}, true).icons[0]?.src).toBe("/icon.svg");
  });
});

describe("tamanoIcono", () => {
  it("acepta solo los tamaños conocidos", () => {
    expect(tamanoIcono("192")).toBe(192);
    expect(tamanoIcono("180")).toBe(180);
    expect(tamanoIcono("9999")).toBe(512);
    expect(tamanoIcono(null)).toBe(512);
  });
});
