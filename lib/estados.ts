/**
 * La máquina de estados de la orden de servicio.
 *
 * Los estados son los mismos para todo tipo de equipo (celulares,
 * patinetas, computadores): las subfases que cada empresa configura
 * (lib/fases.ts) son detalle dentro de un estado, nunca cambian el flujo.
 *
 * Regla del proyecto: si una transición no está en TRANSICIONES, no existe.
 * Ninguna pantalla debe escribir `estado = 'entregada'` por su cuenta —
 * todo cambio de estado pasa por `transicionar()`.
 */

export type Estado =
  | "recibida"
  | "en_diagnostico"
  | "esperando_aprobacion"
  | "en_reparacion"
  | "esperando_repuesto"
  | "listo_entrega"
  | "rechazada"
  | "entregada";

/**
 * "entregada" se alcanza desde cualquier estado no final: hay órdenes que
 * no pasan por diagnóstico ni cotización (un accesorio que se instala al
 * recibir, un equipo que el cliente retira sin reparar) y el mostrador
 * tiene que poder cerrarlas. Lo que no se salta nunca son los requisitos
 * de REQUISITOS.entregada: foto de salida, firma y saldo en cero.
 */
export const TRANSICIONES: Record<Estado, Estado[]> = {
  // El equipo que llega con el precio ya acordado salta diagnóstico,
  // cotización y aprobación (ver sePuedeOmitirCotizacion): de una a
  // reparación, o a esperar repuesto si falta alguno.
  recibida: ["en_diagnostico", "en_reparacion", "esperando_repuesto", "entregada"],
  en_diagnostico: ["esperando_aprobacion", "en_reparacion", "esperando_repuesto", "entregada"],
  // Aprobada sin todos los repuestos, espera sin pasar por reparación:
  // la falta de repuesto no se confunde con reparar.
  esperando_aprobacion: ["en_reparacion", "esperando_repuesto", "rechazada", "entregada"],
  en_reparacion: ["esperando_repuesto", "listo_entrega", "entregada"],
  esperando_repuesto: ["en_reparacion", "entregada"],
  // Si al verificar algo no quedó bien, el equipo vuelve a reparación.
  listo_entrega: ["en_reparacion", "entregada"],
  // Rechazada queda pendiente de decisión: si el cliente reconsidera, se
  // vuelve a diagnóstico y se le envía otra cotización (la rechazada no
  // se borra), o se le entrega sin reparar.
  rechazada: ["en_diagnostico", "entregada"],
  entregada: [],
};

/**
 * Los estados desde los que la ficha del técnico ofrece "Entregada" como
 * siguiente paso. Desde los demás también se puede entregar, pero solo
 * por el mostrador (/entregar), donde se cobra, se firma y se fotografía.
 */
export const ENTREGA_DESDE_TALLER: Estado[] = ["listo_entrega", "rechazada"];

export type Requisito =
  | "tiene_foto_entrada"
  | "tiene_etiqueta"
  | "tiene_tecnico"
  | "tiene_cotizacion"
  | "cotizacion_aprobada"
  | "tiene_foto_salida"
  | "tiene_firma"
  | "saldo_en_cero";

/** Requisitos que la transición HACIA ese estado no puede saltarse. */
export const REQUISITOS: Partial<Record<Estado, Requisito[]>> = {
  // La etiqueta se imprime al recibir, pero no frena el diagnóstico: una
  // impresora apagada no puede dejar la orden sin poder revisarse.
  en_diagnostico: ["tiene_foto_entrada", "tiene_tecnico"],
  esperando_aprobacion: ["tiene_cotizacion"],
  en_reparacion: ["cotizacion_aprobada"],
  esperando_repuesto: ["cotizacion_aprobada"],
  entregada: ["tiene_foto_salida", "tiene_firma", "saldo_en_cero"],
};

/** El estado con el que nace toda orden nueva. */
export const ESTADO_INICIAL: Estado = "recibida";

export const ESTADOS_FINALES: Estado[] = ["entregada"];

export class TransicionInvalidaError extends Error {
  constructor(
    public readonly de: Estado,
    public readonly a: Estado,
  ) {
    super(`No se puede pasar de "${de}" a "${a}": esa transición no existe.`);
    this.name = "TransicionInvalidaError";
  }
}

export class RequisitoFaltanteError extends Error {
  constructor(
    public readonly aEstado: Estado,
    public readonly faltantes: Requisito[],
  ) {
    super(
      `No se puede pasar a "${aEstado}": faltan requisitos (${faltantes.join(", ")}).`,
    );
    this.name = "RequisitoFaltanteError";
  }
}

/** ¿Existe la transición en el grafo? No evalúa requisitos. */
export function puedeTransicionar(de: Estado, a: Estado): boolean {
  return TRANSICIONES[de].includes(a);
}

/**
 * Evalúa una transición completa: que exista en el grafo Y que se cumplan
 * los requisitos de la sección REQUISITOS para el estado de destino.
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

  const requeridos = REQUISITOS[a] ?? [];
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

/** Nombres para mostrar en la interfaz, en un solo lugar. */
export const ETIQUETA_ESTADO: Record<Estado, string> = {
  recibida: "Recibida",
  en_diagnostico: "En diagnóstico",
  esperando_aprobacion: "Esperando aprobación",
  en_reparacion: "En reparación",
  esperando_repuesto: "Esperando repuesto",
  listo_entrega: "Listo para entregar",
  rechazada: "Pendiente de decisión",
  entregada: "Entregada",
};

/**
 * ¿Ya se puede comprar lo que esta orden necesita? Un faltante entra a
 * Compras desde la recepción, pero comprarlo requiere que el cliente
 * haya aprobado: hasta entonces Compras lo ve marcado como en espera.
 */
export function comprasAutorizadas(estado: Estado): boolean {
  return estado === "en_reparacion" || estado === "esperando_repuesto" || estado === "listo_entrega";
}

/**
 * A dónde va la orden cuando el cliente aprueba: a reparación, o a
 * esperar repuesto si alguno de los que necesita todavía no ha llegado.
 */
export function estadoAlAprobar(repuestosPendientes: number): Estado {
  return repuestosPendientes > 0 ? "esperando_repuesto" : "en_reparacion";
}

/**
 * ¿Se puede quitar algo que ya está en la orden (orden_item)? Solo
 * mientras no se haya enviado la cotización: antes de eso, una línea
 * agregada por error se corrige; después, el cliente ya vio ese total.
 */
export function itemsSeQuitan(estado: Estado): boolean {
  return estado === "recibida" || estado === "en_diagnostico";
}

/**
 * ¿Puede esta orden saltarse diagnóstico, cotización y aprobación? Solo
 * antes de cotizar y si ya trae un precio acordado (orden.total > 0, lo
 * que se pactó al recibir o se registró después). Ese precio hace las
 * veces de la cotización aprobada para pasar a reparación.
 */
export function sePuedeOmitirCotizacion(estado: Estado, totalOrden: number): boolean {
  return (estado === "recibida" || estado === "en_diagnostico") && totalOrden > 0;
}
