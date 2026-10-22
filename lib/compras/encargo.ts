/**
 * Encargos de mostrador: lo que un cliente pide desde Vender y no hay.
 * Va a la misma lista de Compras que lo que piden las órdenes, pero en
 * vez de número de orden lleva el nombre y el teléfono de a quién hay
 * que traérselo (0062_compra_por_orden.sql). La ruta es
 * app/api/repuesto-solicitud/route.ts.
 */
import { normalizarTelefonoWhatsapp } from "./whatsapp";

export const PRIORIDADES = ["normal", "alta", "urgente"] as const;

export interface Encargo {
  descripcion: string;
  cantidad: number;
  prioridad: (typeof PRIORIDADES)[number];
  clienteId: string | null;
  clienteNombre: string;
  clienteTelefono: string;
}

export function normalizarEncargo(body: unknown): { ok: true; datos: Encargo } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const descripcion = texto(b.descripcion);
  const cantidad = Math.floor(Number(b.cantidad ?? 1));
  const clienteNombre = texto(b.clienteNombre);
  const clienteTelefono = texto(b.clienteTelefono);
  const prioridad = PRIORIDADES.find((p) => p === b.prioridad) ?? "normal";
  if (!descripcion) return { ok: false, error: "Escribe qué hay que traer" };
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { ok: false, error: "La cantidad debe ser mayor a cero" };
  if (!clienteNombre) return { ok: false, error: "Falta el nombre del cliente" };
  if (!normalizarTelefonoWhatsapp(clienteTelefono)) return { ok: false, error: "Falta el teléfono del cliente" };
  return {
    ok: true,
    datos: {
      descripcion: descripcion.slice(0, 200),
      cantidad,
      prioridad,
      clienteId: typeof b.clienteId === "string" && b.clienteId ? b.clienteId : null,
      clienteNombre: clienteNombre.slice(0, 120),
      clienteTelefono: clienteTelefono.slice(0, 40),
    },
  };
}

/** El mensaje para avisarle al cliente que ya llegó lo que encargó. */
export function mensajeEncargoListo(e: { clienteNombre: string | null; producto: string; empresa?: string | null }): string {
  const nombre = e.clienteNombre?.trim().split(" ")[0];
  const desde = e.empresa?.trim() ? ` en ${e.empresa.trim()}` : "";
  return `Hola${nombre ? ` ${nombre}` : ""}, ya llegó lo que encargaste${desde}: ${e.producto}. Te esperamos.`;
}
