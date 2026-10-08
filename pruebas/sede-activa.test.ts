import { beforeEach, describe, expect, it, vi } from "vitest";

let cookieSede: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieSede ? { value: cookieSede } : undefined) }),
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverSedeActiva, sedesPermitidas } from "../lib/sede-activa";

const LOCAL1 = { id: "s1", nombre: "Local 1" };
const NOVENA = { id: "s9", nombre: "LOCAL NOVENA" };
const CD2 = { id: "s2", nombre: "CD2" };

/** Un cliente falso que responde a from("sede") y from("perfil_sede"). */
function clienteFalso(tablas: { sede?: object[]; perfil_sede?: object[] }) {
  const consulta = (filas: object[]) => {
    const promesa = Promise.resolve({ data: filas, error: null });
    return Object.assign(promesa, { order: () => promesa, eq: () => promesa });
  };
  return {
    from: (tabla: "sede" | "perfil_sede") => ({ select: () => consulta(tablas[tabla] ?? []) }),
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  cookieSede = undefined;
});

describe("sedesPermitidas", () => {
  it("un admin entra a todas las sedes de la empresa", async () => {
    const sedes = await sedesPermitidas(clienteFalso({ sede: [LOCAL1, NOVENA, CD2] }), {
      id: "u",
      rol: "admin",
      sedePrincipal: null,
    });
    expect(sedes.map((s) => s.id)).toEqual(["s2", "s1", "s9"]);
  });

  it("el resto entra a sus filas de perfil_sede más su sede principal", async () => {
    const sedes = await sedesPermitidas(clienteFalso({ perfil_sede: [{ sede: NOVENA }] }), {
      id: "u",
      rol: "cajero",
      sedePrincipal: LOCAL1,
    });
    expect(sedes.map((s) => s.id)).toEqual(["s1", "s9"]);
  });

  it("sin la migración aplicada (perfil_sede vacío) conserva la sede principal", async () => {
    const sedes = await sedesPermitidas(clienteFalso({}), { id: "u", rol: "tecnico", sedePrincipal: CD2 });
    expect(sedes).toEqual([CD2]);
  });
});

describe("resolverSedeActiva", () => {
  it("con una sola sede no hay nada que elegir", async () => {
    expect(await resolverSedeActiva([LOCAL1])).toEqual(LOCAL1);
  });

  it("con varias usa la elegida en el dispositivo", async () => {
    cookieSede = "s9";
    expect(await resolverSedeActiva([LOCAL1, NOVENA])).toEqual(NOVENA);
  });

  it("con varias y sin elección pide elegir", async () => {
    expect(await resolverSedeActiva([LOCAL1, NOVENA])).toBeNull();
  });

  it("ignora una cookie de una sede no permitida", async () => {
    cookieSede = "s2";
    expect(await resolverSedeActiva([LOCAL1, NOVENA])).toBeNull();
  });
});
