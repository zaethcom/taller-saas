/**
 * Lo hecho sin internet que falta subir (plan sin internet, fases 3 y
 * 3b): ventas, abonos y entregas de órdenes.
 *
 * Cada elemento es una petición POST guardada tal cual se habría
 * enviado, con una clave local (0070) que el servidor usa para no
 * crearla dos veces si el envío se repite. Vive en IndexedDB
 * (base-local.ts, almacén «cola») y se envía en orden, del más viejo al
 * más nuevo, cuando vuelve la conexión (componentes/sin-conexion/
 * sincronizar-copia.tsx).
 *
 * Qué pasa con cada envío (resultadoEnvio):
 * - 2xx sin avisos: listo, sale de la cola.
 * - 2xx con avisos (p. ej. no había existencia para descontar): queda
 *   como «aviso» para que alguien lo revise; ya está subido.
 * - 401: la sesión venció; se reintenta después de volver a entrar.
 * - Otro error del servidor (turno cerrado, artículo ya vendido…):
 *   queda como «error» con el mensaje, para revisar; no se reintenta
 *   solo, porque fallaría igual.
 * - Sin red: se deja para el siguiente intento.
 *
 * La cola NO se borra al cerrar sesión: son ventas cobradas. Solo se
 * envían los elementos del usuario con sesión, para que cada venta
 * quede a nombre de quien la hizo.
 */
import { ALMACEN_COLA, operar } from "./base-local";

export type EstadoElemento = "pendiente" | "error" | "aviso";

export interface ElementoCola {
  /** La clave local (uuid): también va en el cuerpo como claveLocal. */
  id: string;
  /** venta (fase 3); abono, cobro de saldo y entrega de una orden (fase 3b). */
  tipo: "venta" | "abono" | "cobro_orden" | "entrega";
  creadoEn: string;
  empresaId: string;
  sedeId: string;
  usuarioId: string;
  /** Texto corto para la lista de revisión: «Venta · $45.000 · 3 unidades». */
  descripcion: string;
  url: string;
  cuerpo: Record<string, unknown>;
  estado: EstadoElemento;
  intentos: number;
  mensaje?: string;
  avisos?: string[];
  /** Número que le dio el servidor, cuando ya se subió. */
  numero?: number;
}

export type ResultadoEnvio = "listo" | "aviso" | "reintentar" | "error";

export function resultadoEnvio(status: number, datos: { avisos?: unknown } | null): ResultadoEnvio {
  if (status >= 200 && status < 300) {
    return Array.isArray(datos?.avisos) && datos.avisos.length > 0 ? "aviso" : "listo";
  }
  if (status === 401) return "reintentar";
  return "error";
}

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Avisa a quien muestre la cola (franja de conexión, pantalla de revisión). */
export function suscribirCola(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function avisar() {
  for (const o of oyentes) o();
}

export function nuevaClaveLocal(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Navegadores sin randomUUID: uuid v4 con getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function listarCola(): Promise<ElementoCola[]> {
  const todos = (await operar<ElementoCola[]>(ALMACEN_COLA, "readonly", (a) => a.getAll())) ?? [];
  return todos.sort((x, y) => x.creadoEn.localeCompare(y.creadoEn));
}

/** Guarda en la cola. Devuelve false si el equipo no pudo guardarlo (sin IndexedDB). */
export async function agregarACola(elemento: Omit<ElementoCola, "estado" | "intentos">): Promise<boolean> {
  const ok = await operar(ALMACEN_COLA, "readwrite", (a) => a.put({ ...elemento, estado: "pendiente", intentos: 0 }));
  avisar();
  return ok !== null;
}

async function guardarElemento(e: ElementoCola) {
  await operar(ALMACEN_COLA, "readwrite", (a) => a.put(e));
}

export async function quitarDeCola(id: string): Promise<void> {
  await operar(ALMACEN_COLA, "readwrite", (a) => a.delete(id));
  avisar();
}

/** Vuelve a poner un elemento con error como pendiente (botón Reintentar). */
export async function reintentarElemento(id: string): Promise<void> {
  const e = (await listarCola()).find((x) => x.id === id);
  if (!e) return;
  await guardarElemento({ ...e, estado: "pendiente", mensaje: undefined });
  avisar();
}

let enviando = false;

/**
 * Envía los pendientes del usuario, en orden. Se detiene en el primer
 * fallo de red o de sesión (lo demás tampoco va a pasar). Devuelve
 * cuántos quedaron subidos en esta pasada.
 */
export async function enviarCola(usuarioId: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  if (enviando) return 0;
  enviando = true;
  let subidos = 0;
  try {
    const pendientes = (await listarCola()).filter((e) => e.estado === "pendiente" && e.usuarioId === usuarioId);
    for (const e of pendientes) {
      let res: Response;
      try {
        res = await fetchImpl(e.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(e.cuerpo),
        });
      } catch {
        break; // sin red: se intenta en la próxima pasada
      }
      const datos = (await res.json().catch(() => null)) as { avisos?: string[]; error?: string; numero?: number } | null;
      const resultado = resultadoEnvio(res.status, datos);
      if (resultado === "reintentar") break;
      if (resultado === "listo") {
        await operar(ALMACEN_COLA, "readwrite", (a) => a.delete(e.id));
        subidos++;
      } else if (resultado === "aviso") {
        await guardarElemento({ ...e, estado: "aviso", intentos: e.intentos + 1, avisos: datos?.avisos, numero: datos?.numero });
        subidos++;
      } else {
        await guardarElemento({
          ...e,
          estado: "error",
          intentos: e.intentos + 1,
          mensaje: datos?.error ?? `El servidor respondió ${res.status}`,
        });
      }
    }
  } finally {
    enviando = false;
    avisar();
  }
  return subidos;
}
