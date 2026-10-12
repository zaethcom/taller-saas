/**
 * El camino de la orden como lo cuenta el taller: recibir, diagnosticar y
 * cotizar, aprobación del cliente, reparar, terminado, entregar. Cada
 * paso agrupa los estados de lib/estados.ts que le corresponden (la
 * máquina de estados no cambia), y para cada estado se dice cuál es el
 * siguiente paso y con qué botones se da.
 */
import type { Estado } from "@/lib/estados";

/** Pantallas de la orden a las que lleva un botón. */
export type Destino = "diagnostico" | "cotizacion" | "evidencia" | "repuestos" | "entregar";

export interface Paso {
  titulo: string;
  estados: Estado[];
  /** Las pantallas de este paso: se abren desde el camino, junto al
   *  paso, cuando ya se llegó a él (no antes, para no confundir). */
  enlaces: { destino: Destino; texto: string }[];
}

export const CAMINO: Paso[] = [
  { titulo: "Recibido", estados: ["recibida"], enlaces: [{ destino: "evidencia", texto: "Fotos y videos" }] },
  {
    titulo: "Diagnóstico y cotización",
    estados: ["en_diagnostico"],
    enlaces: [
      { destino: "diagnostico", texto: "Diagnóstico" },
      { destino: "cotizacion", texto: "Cotización" },
    ],
  },
  { titulo: "Aprobación del cliente", estados: ["esperando_aprobacion", "rechazada"], enlaces: [] },
  { titulo: "Reparación", estados: ["en_reparacion", "esperando_repuesto"], enlaces: [{ destino: "repuestos", texto: "Repuestos" }] },
  { titulo: "Terminado", estados: ["listo_entrega"], enlaces: [] },
  { titulo: "Entregado", estados: ["entregada"], enlaces: [] },
];

/** Los enlaces de un paso se muestran si la orden ya llegó a él. El
 *  diagnóstico se abre desde "Recibido" también: ahí se empieza. */
export function enlacesVisibles(indicePaso: number, estado: Estado): Paso["enlaces"] {
  const actual = pasoActual(estado);
  const llegoA = indicePaso <= actual || (indicePaso === 1 && actual === 0);
  return llegoA ? CAMINO[indicePaso]!.enlaces : [];
}

/** En qué paso del camino va la orden. */
export function pasoActual(estado: Estado): number {
  return CAMINO.findIndex((p) => p.estados.includes(estado));
}

export type Accion =
  | { tipo: "ir"; destino: Destino; texto: string }
  | { tipo: "estado"; a: Estado; texto: string }
  /** El cliente aprobó en persona o por teléfono (misma ruta que su enlace). */
  | { tipo: "aprobar"; texto: string };

export interface SiguientePaso {
  titulo: string;
  ayuda: string;
  /** La primera es la principal. */
  acciones: Accion[];
}

export function siguientePaso(estado: Estado): SiguientePaso {
  switch (estado) {
    case "recibida":
    case "en_diagnostico":
      return {
        titulo: "Diagnosticar y cotizar",
        ayuda:
          "Anota qué tiene el equipo y arma la cotización con lo que lleva. Al enviarla, la orden queda esperando que el cliente apruebe.",
        acciones: [
          { tipo: "ir", destino: "diagnostico", texto: "Diagnosticar y cotizar" },
          { tipo: "ir", destino: "evidencia", texto: "Tomar fotos" },
        ],
      };
    case "esperando_aprobacion":
      return {
        titulo: "Esperando aprobación",
        ayuda: "El cliente aprueba desde su enlace. Si lo hizo aquí o por teléfono, regístralo.",
        acciones: [
          { tipo: "aprobar", texto: "El cliente aprobó" },
          { tipo: "estado", a: "rechazada", texto: "El cliente no aprobó" },
        ],
      };
    case "rechazada":
      return {
        titulo: "Pendiente de decisión del cliente",
        ayuda: "Si el cliente reconsidera, envíale otra cotización. Si no, entrégale el equipo sin reparar.",
        acciones: [
          { tipo: "ir", destino: "cotizacion", texto: "Volver a cotizar" },
          { tipo: "ir", destino: "entregar", texto: "Entregar sin reparar" },
        ],
      };
    case "en_reparacion":
      return {
        titulo: "Reparar",
        ayuda: "Usa los repuestos del inventario. Al terminar, marca el equipo como terminado.",
        acciones: [
          { tipo: "estado", a: "listo_entrega", texto: "Equipo terminado" },
          { tipo: "ir", destino: "repuestos", texto: "Repuestos" },
          { tipo: "estado", a: "esperando_repuesto", texto: "Falta un repuesto" },
        ],
      };
    case "esperando_repuesto":
      return {
        titulo: "Esperando repuesto",
        ayuda: "Compras ya lo tiene en la lista. Cuando llegue, sigue con la reparación.",
        acciones: [{ tipo: "estado", a: "en_reparacion", texto: "Llegó el repuesto: seguir reparando" }],
      };
    case "listo_entrega":
      return {
        titulo: "Entregar",
        ayuda: "En Entregar se cobra el saldo, firma el cliente y se toma la foto de salida.",
        acciones: [
          { tipo: "ir", destino: "entregar", texto: "Entregar" },
          { tipo: "estado", a: "en_reparacion", texto: "Volver a reparación" },
        ],
      };
    case "entregada":
      return { titulo: "Orden entregada", ayuda: "El equipo ya salió del taller.", acciones: [] };
  }
}
