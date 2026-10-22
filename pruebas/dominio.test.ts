import { describe, expect, it } from "vitest";
import { urlDominioPrincipal } from "../lib/dominio";

describe("urlDominioPrincipal", () => {
  it("manda las páginas de la dirección vieja al dominio con www", () => {
    expect(urlDominioPrincipal("taller-saas-mvp.vercel.app", "GET", "/login", "")).toBe(
      "https://www.taller360.app/login",
    );
    expect(urlDominioPrincipal("taller360.app", "GET", "/seguimiento/abc", "?x=1")).toBe(
      "https://www.taller360.app/seguimiento/abc?x=1",
    );
    expect(urlDominioPrincipal("taller-saas-mvp.vercel.app", "HEAD", "/", "")).toBe(
      "https://www.taller360.app/",
    );
  });

  it("no toca el dominio principal, vistas previas ni localhost", () => {
    expect(urlDominioPrincipal("www.taller360.app", "GET", "/login", "")).toBeNull();
    expect(urlDominioPrincipal("taller-saas-mvp-git-rama.vercel.app", "GET", "/", "")).toBeNull();
    expect(urlDominioPrincipal("localhost:3000", "GET", "/", "")).toBeNull();
    expect(urlDominioPrincipal(null, "GET", "/", "")).toBeNull();
  });

  it("deja quieto lo que usan las estaciones de impresión y los archivos", () => {
    const viejo = "taller-saas-mvp.vercel.app";
    expect(urlDominioPrincipal(viejo, "GET", "/api/impresion/pendientes", "?sede=1")).toBeNull();
    expect(urlDominioPrincipal(viejo, "POST", "/login", "")).toBeNull();
    expect(urlDominioPrincipal(viejo, "GET", "/estacion", "")).toBeNull();
    expect(urlDominioPrincipal(viejo, "GET", "/sw.js", "")).toBeNull();
    expect(urlDominioPrincipal(viejo, "GET", "/_next/data/x", "")).toBeNull();
  });
});
