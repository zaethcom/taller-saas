/**
 * La máquina de estados de la orden de servicio.
 *
 * Las doce fases del documento original describen la operación, no doce
 * estados del sistema. Aquí son cinco, y las demás quedan como notas y
 * evidencias dentro de un estado.
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
  | "rechazada"
  | "entregada";

export const TRANSICIONES: Record<Estado, Estado[]> = {
  recibida: ["en_diagnostico"],
  en_diagnostico: ["esperando_aprobacion"],
  esperando_aprobacion: ["en_reparacion", "rechazada"],
  en_reparacion: ["esperando_repuesto", "entregada"],
  esperando_repuesto: ["en_reparacion"],
  rechazada: ["entregada"],
  entregada: [],
};

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
  en_diagnostico: ["tiene_foto_entrada", "tiene_etiqueta", "tiene_tecnico"],
  esperando_aprobacion: ["tiene_cotizacion"],
  en_reparacion: ["cotizacion_aprobada"],
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
  rechazada: "Rechazada",
  entregada: "Entregada",
};
