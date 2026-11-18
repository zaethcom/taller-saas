/**
 * `fetch` para las lecturas que deben seguir funcionando sin internet
 * (plan sin internet, fase 2). Con conexión es exactamente un fetch: va
 * al servidor y devuelve su respuesta. Solo si la petición falla por
 * red (sin internet, servidor inalcanzable) responde con la copia local
 * guardada en el equipo (copia-local.ts), en la misma forma que habría
 * respondido el servidor.
 *
 * Una respuesta salida de la copia trae la cabecera CABECERA_COPIA con
 * la hora en que se bajó la copia, por si la pantalla quiere decirlo.
 */
import { leerCopia } from "./copia-local";
import { buscarArticulosLocal, buscarClientesLocal, buscarRepuestosLocal } from "./busqueda-local";
import type { CopiaLocal } from "./tipos";

export const CABECERA_COPIA = "X-Taller-Copia-Local";

/** Qué respondería el servidor para esta URL, sacado de la copia. null si la copia no lo cubre. */
export function respuestaDesdeCopia(copia: CopiaLocal, url: string): unknown | null {
  const u = new URL(url, "http://local");
  const p = u.searchParams;
  switch (u.pathname) {
    case "/api/repuestos":
      if (p.get("venta") !== "1") return null;
      return buscarRepuestosLocal(copia, p.get("buscar") ?? "", p.get("categoriaId"));
    case "/api/inventario/articulos":
      if (p.get("disponibles") !== "1") return null;
      return buscarArticulosLocal(copia, p.get("buscar") ?? "", p.get("categoriaId"));
    case "/api/categorias":
      return copia.categorias;
    case "/api/metodos-pago":
      return copia.metodosPago.filter((m) => m.activo !== false);
    case "/api/turno/actual":
      return copia.turno;
    case "/api/clientes": {
      const q = (p.get("q") ?? p.get("documento") ?? "").trim();
      if (!q) return null;
      return { clientes: buscarClientesLocal(copia.clientes, q, p.get("nombre") === "1") };
    }
    default:
      return null;
  }
}

export async function leerApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    const copia = await leerCopia();
    const datos = copia ? respuestaDesdeCopia(copia, url) : null;
    if (copia === null || datos === null) throw error;
    return new Response(JSON.stringify(datos), {
      status: 200,
      headers: { "Content-Type": "application/json", [CABECERA_COPIA]: copia.generadaEn },
    });
  }
}
