/**
 * La máquina de estados de la orden de servicio.
 *
 * Cuatro estados mientras el equipo está en el taller, más "entregada"
 * (decisión de Frank, 2026-10-22, supabase/migrations/0065_estados_simples.sql):
 * los estados de en medio (recibida, en diagnóstico, en reparación...)
 * no se movían a mano y la lista de órdenes no decía la verdad. Ahora
 * toda orden nace "en proceso" y solo cambia cuando hay algo que el
 * mostrador o el cliente deben saber; casi todo cambio pasa solo:
 *
 * - pedir algo a Compras para la orden → falta_repuesto, y al llegar lo
 *   último vuelve sola a en_proceso (lib/compras/recepcion-orden.ts);
 * - enviar una cotización → esperando_cliente, y al aprobar vuelve a
 *   en_proceso (o a falta_repuesto si falta algo);
 * - el técnico solo marca "Terminado" (listo_entrega) o "Falta repuesto".
 *
 * Regla del proyecto: si una transición no está en TRANSICIONES, no existe.
 * Ninguna pantalla debe escribir `estado = 'entregada'` por su cuenta —
 * todo cambio de estado pasa por `transicionar()`.
 */

export type Estado = "en_proceso" | "falta_repuesto" | "esperando_cliente" | "listo_entrega" | "entregada";

/**
 * "entregada" se alcanza desde cualquier estado no final: un equipo que
 * el cliente retira sin reparar, o un accesorio que se instala al
 * recibir. Lo que no se salta nunca son los requisitos de
 * REQUISITOS.entregada: foto de salida, firma y saldo en cero.
 */
export const TRANSICIONES: Record<Estado, Estado[]> = {
  en_proceso: ["falta_repuesto", "esperando_cliente", "listo_entrega", "entregada"],
  // Se puede cotizar algo más mientras se espera el repuesto.
  falta_repuesto: ["en_proceso", "esperando_cliente", "entregada"],
  // Sale al aprobar (ver REQUISITOS_AL_SALIR) o entregando sin reparar.
  esperando_cliente: ["en_proceso", "falta_repuesto", "entregada"],
  // Si al verificar algo no quedó bien, el equipo vuelve a proceso.
  listo_entrega: ["en_proceso", "entregada"],
  entregada: [],
};

/**
 * Los estados desde los que la ficha del técnico ofrece entregar, y los
 * que la lista de órdenes cuenta como "listas". Desde los demás también
 * se puede entregar, pero solo por el mostrador (/entregar).
 */
export const ENTREGA_DESDE_TALLER: Estado[] = ["listo_entrega"];

export type Requisito =
  | "tiene_cotizacion"
  | "cotizacion_aprobada"
  | "tiene_foto_salida"
  | "tiene_firma"
  | "saldo_en_cero";

/** Requisitos que la transición HACIA ese estado no puede saltarse. */
export const REQUISITOS: Partial<Record<Estado, Requisito[]>> = {
  esperando_cliente: ["tiene_cotizacion"],
  entregada: ["tiene_foto_salida", "tiene_firma", "saldo_en_cero"],
};

/**
 * Requisitos para SALIR de un estado hacia cualquier otro que no sea
 * "entregada": la orden que espera al cliente sigue cuando él aprueba,
 * no cuando alguien del taller decide seguir sin su permiso.
 */
export const REQUISITOS_AL_SALIR: Partial<Record<Estado, Requisito[]>> = {
  esperando_cliente: ["cotizacion_aprobada"],
};

/** El estado con el que nace toda orden nueva. */
export const ESTADO_INICIAL: Estado = "en_proceso";

export const ESTADOS_FINALES: Estado[] = ["entregada"];

export class TransicionInvalidaError extends Error {
  constructor(
    public readonly de: Estado,
    public readonly a: Estado,
  ) {
    super(`No se puede pasar de "${etiquetaEstado(de)}" a "${etiquetaEstado(a)}".`);
    this.name = "TransicionInvalidaError";
  }
}

export class RequisitoFaltanteError extends Error {
  constructor(
    public readonly aEstado: Estado,
    public readonly faltantes: Requisito[],
  ) {
    super(
      `No se puede pasar a "${etiquetaEstado(aEstado)}": faltan requisitos (${faltantes.join(", ")}).`,
    );
    this.name = "RequisitoFaltanteError";
  }
}

/** ¿Existe la transición en el grafo? No evalúa requisitos. */
export function puedeTransicionar(de: Estado, a: Estado): boolean {
  return TRANSICIONES[de]?.includes(a) ?? false;
}

/**
 * Evalúa una transición completa: que exista en el grafo Y que se cumplan
 * los requisitos para el estado de destino (y para salir del de origen).
 *
 * `cumplidos` es el conjunto de requisitos que la orden ya satisface —
 * lo arma quien llama, consultando la orden real (fotos, cotización, etc).
 *
 * Lanza en vez de devolver boolean porque el llamador casi siempre necesita
 * saber POR QUÉ falló para mostrárselo a quien está usando el sistema.
 */
export function transicionar(
  de: Estado,
  a: Estado,
  cumplidos: ReadonlySet<Requisito>,
): void {
  if (!puedeTransicionar(de, a)) {
    throw new TransicionInvalidaError(de, a);
  }

  const requeridos = [...(REQUISITOS[a] ?? []), ...(a === "entregada" ? [] : (REQUISITOS_AL_SALIR[de] ?? []))];
  const faltantes = requeridos.filter((r) => !cumplidos.has(r));

  if (faltantes.length > 0) {
    throw new RequisitoFaltanteError(a, faltantes);
  }
}

/** Los estados a los que se puede pasar ahora mismo, sin evaluar requisitos. */
export function siguientesEstados(de: Estado): Estado[] {
  return TRANSICIONES[de];
}

export function esFinal(estado: Estado): boolean {
  return ESTADOS_FINALES.includes(estado);
}

export function esEstado(valor: unknown): valor is Estado {
  return typeof valor === "string" && valor in TRANSICIONES;
}

/** Nombres para mostrar en la interfaz, en un solo lugar. */
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  en_proceso: "En proceso",
  falta_repuesto: "Falta repuesto",
  esperando_cliente: "Esperando al cliente",
  listo_entrega: "Listo para entregar",
  entregada: "Entregada",
};

/**
 * Los estados de antes de 0065 siguen en orden_evento: el historial se
 * conserva tal cual pasó y se lee con sus nombres de entonces.
 */
const ETIQUETA_ESTADO_ANTERIOR: Record<string, string> = {
  recibida: "Recibida",
  en_diagnostico: "En diagnóstico",
  esperando_aprobacion: "Esperando aprobación",
  en_reparacion: "En reparación",
  esperando_repuesto: "Esperando repuesto",
  rechazada: "Pendiente de decisión",
};

/** El nombre de un estado, actual o de un evento anterior a 0065. */
export function etiquetaEstado(valor: string): string {
  return esEstado(valor) ? ETIQUETA_ESTADO[valor] : (ETIQUETA_ESTADO_ANTERIOR[valor] ?? valor);
}

/** Cómo lo lee el cliente en su enlace de seguimiento. */
export const ETIQUETA_ESTADO_CLIENTE: Record<Estado, string> = {
  en_proceso: "En proceso",
  falta_repuesto: "Esperando repuesto",
  esperando_cliente: "Esperando tu aprobación",
  listo_entrega: "Listo para recoger",
  entregada: "Entregado",
};

/**
 * ¿Ya se puede comprar lo que esta orden necesita? Siempre, salvo
 * mientras el cliente decide una cotización: hasta que diga que sí,
 * Compras lo ve marcado como en espera.
 */
export function comprasAutorizadas(estado: Estado): boolean {
  return estado !== "esperando_cliente" && estado !== "entregada";
}

/**
 * Cómo sigue una orden en proceso según lo que le falte: si tiene
 * repuestos pedidos a Compras sin llegar, falta repuesto; si no, en
 * proceso. Se usa al aprobar el cliente y al pedir algo a Compras.
 */
export function estadoSegunRepuestos(repuestosPendientes: number): Estado {
  return repuestosPendientes > 0 ? "falta_repuesto" : "en_proceso";
}

/**
 * ¿Se puede quitar algo que ya está en la orden (orden_item)? Mientras
 * no se haya enviado una cotización: antes de eso, una línea agregada
 * por error se corrige; después, el cliente ya vio ese total.
 */
export function itemsSeQuitan(estado: Estado, cotizacionEnviada: boolean): boolean {
  return !cotizacionEnviada && !esFinal(estado);
}
