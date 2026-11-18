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
import { buscarOrdenLocal } from "./orden-local";
import type { CopiaLocal } from "./tipos";

export const CABECERA_COPIA = "X-Taller-Copia-Local";

/** Una respuesta de error armada desde la copia (p. ej. la orden no está en este equipo). */
export class ErrorDesdeCopia {
  constructor(
    readonly status: number,
    readonly error: string,
  ) {}
}

/**
 * Qué respondería el servidor para esta URL, sacado de la copia. null si
 * la copia no lo cubre; ErrorDesdeCopia si lo cubre pero no lo encuentra.
 */
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
    case "/api/configuracion":
      return copia.configuracion ?? null;
    case "/api/clientes": {
      const q = (p.get("q") ?? p.get("documento") ?? "").trim();
      if (!q) return null;
      return { clientes: buscarClientesLocal(copia.clientes, q, p.get("nombre") === "1") };
    }
    case "/api/ordenes/buscar": {
      const orden = buscarOrdenLocal(copia, { numero: p.get("numero"), token: p.get("token") });
      return (
        orden ??
        new ErrorDesdeCopia(
          404,
          "Sin conexión: esta orden no está en la copia de este equipo (solo están las órdenes abiertas de la sede).",
        )
      );
    }
    case "/api/perfil":
      // Sin conexión Cobrar y entregar solo necesita la empresa.
      return { empresaId: copia.empresaId, sedeId: copia.sedeId, id: copia.usuarioId };
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
    const fallo = datos instanceof ErrorDesdeCopia ? datos : null;
    return new Response(JSON.stringify(fallo ? { error: fallo.error } : datos), {
      status: fallo?.status ?? 200,
      headers: { "Content-Type": "application/json", [CABECERA_COPIA]: copia.generadaEn },
    });
  }
}
