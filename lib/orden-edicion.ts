/**
 * Corregir los datos de una orden después de recibir el equipo: el
 * cliente, el equipo y lo que se anotó en la recepción. Lo puro vive
 * aquí (qué cambió, cómo se anota en el historial) para probarlo sin
 * base; la ruta es app/api/ordenes/[id]/datos/route.ts.
 *
 * Los cambios quedan en orden_evento como un evento sin cambio de
 * estado cuya nota empieza con PREFIJO_EDICION. No es un paso del
 * equipo, así que el seguimiento del cliente no lo muestra.
 */

export const PREFIJO_EDICION = "Datos corregidos";

export interface DatosCliente {
  nombre: string;
  documento: string;
  telefono: string;
  correo: string;
}

export interface DatosEquipo {
  serial: string;
  tipo: string;
  marca: string;
  modelo: string;
}

export interface DatosOrden {
  motivo: string;
  infoAdicional: string;
  telefonoAlterno: string;
}

export interface DatosEdicion {
  cliente: DatosCliente;
  equipo: DatosEquipo;
  orden: DatosOrden;
  /** null: el valor no se puede cambiar en este estado de la orden. */
  valorServicio: number | null;
}

/** Cómo se llama cada campo en la nota del historial. */
const NOMBRE_CAMPO = {
  cliente: { nombre: "nombre del cliente", documento: "documento", telefono: "teléfono", correo: "correo" },
  equipo: { serial: "serial", tipo: "tipo de equipo", marca: "marca", modelo: "modelo" },
  orden: { motivo: "daño y motivo", infoAdicional: "info adicional", telefonoAlterno: "número alternativo" },
} as const;

const limpiar = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
// El motivo puede traer saltos de línea a propósito: solo se recortan los bordes.
const limpiarTexto = (s: string | null | undefined) => (s ?? "").trim();

/** Lo que llega del formulario, recortado. Lo vacío queda como "". */
export function normalizarDatos(d: DatosEdicion): DatosEdicion {
  return {
    cliente: {
      nombre: limpiar(d.cliente?.nombre),
      documento: limpiar(d.cliente?.documento),
      telefono: limpiar(d.cliente?.telefono),
      correo: limpiar(d.cliente?.correo),
    },
    equipo: {
      serial: limpiar(d.equipo?.serial),
      tipo: limpiar(d.equipo?.tipo),
      marca: limpiar(d.equipo?.marca),
      modelo: limpiar(d.equipo?.modelo),
    },
    orden: {
      motivo: limpiarTexto(d.orden?.motivo),
      infoAdicional: limpiarTexto(d.orden?.infoAdicional),
      telefonoAlterno: limpiar(d.orden?.telefonoAlterno),
    },
    valorServicio:
      d.valorServicio === null || d.valorServicio === undefined
        ? null
        : Math.max(0, Math.round(Number(d.valorServicio) || 0)),
  };
}

/** Lo que falta para poder guardar, en el formato de la ventana de errores. */
export function validarDatos(d: DatosEdicion): string[] {
  const faltas: string[] = [];
  if (!d.cliente.nombre) faltas.push("Falta el nombre del cliente");
  if (!d.equipo.serial) faltas.push("Falta el serial del equipo");
  if (!d.equipo.tipo) faltas.push("Falta el tipo de equipo");
  if (!d.orden.motivo) faltas.push("Falta el daño y motivo");
  if (d.cliente.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.cliente.correo)) {
    faltas.push("El correo no parece válido");
  }
  return faltas;
}

export interface Cambio {
  campo: string;
  antes: string;
  despues: string;
}

export interface CambiosEdicion {
  cliente: Partial<DatosCliente>;
  equipo: Partial<DatosEquipo>;
  orden: Partial<DatosOrden>;
  valorServicio: number | null;
  /** Para la nota del historial, en el orden del formulario. */
  lista: Cambio[];
}

function diferencias<T extends object>(
  antes: T,
  despues: T,
  nombres: Record<keyof T, string>,
  lista: Cambio[],
): Partial<T> {
  const cambios: Partial<T> = {};
  for (const k of Object.keys(nombres) as (keyof T)[]) {
    const a = String(antes[k] ?? "");
    const d = String(despues[k] ?? "");
    if (a !== d) {
      cambios[k] = despues[k];
      lista.push({ campo: nombres[k], antes: a, despues: d });
    }
  }
  return cambios;
}

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Qué cambió entre lo guardado y lo que se quiere guardar (ambos normalizados). */
export function calcularCambios(antes: DatosEdicion, despues: DatosEdicion): CambiosEdicion {
  const lista: Cambio[] = [];
  const cliente = diferencias(antes.cliente, despues.cliente, NOMBRE_CAMPO.cliente, lista);
  const equipo = diferencias(antes.equipo, despues.equipo, NOMBRE_CAMPO.equipo, lista);
  const orden = diferencias(antes.orden, despues.orden, NOMBRE_CAMPO.orden, lista);
  let valorServicio: number | null = null;
  if (antes.valorServicio !== null && despues.valorServicio !== null && antes.valorServicio !== despues.valorServicio) {
    valorServicio = despues.valorServicio;
    lista.push({ campo: "valor del servicio", antes: pesos(antes.valorServicio), despues: pesos(despues.valorServicio) });
  }
  return { cliente, equipo, orden, valorServicio, lista };
}

const corto = (s: string) => {
  if (!s) return "(vacío)";
  const una = s.replace(/\s+/g, " ");
  return una.length > 60 ? `${una.slice(0, 57)}…` : una;
};

/** La nota del evento en el historial: quién corrigió y qué. */
export function notaEdicion(lista: Cambio[], autor: string | null): string {
  const detalle = lista.map((c) => `${c.campo}: ${corto(c.antes)} → ${corto(c.despues)}`).join("; ");
  return `${PREFIJO_EDICION}${autor ? ` por ${autor}` : ""}. ${detalle}`;
}

/** ¿Este evento del historial es una corrección de datos y no un paso del equipo? */
export function esEventoEdicion(e: { de_estado: string | null; a_estado: string; nota?: string | null }): boolean {
  return e.de_estado === e.a_estado && (e.nota ?? "").startsWith(PREFIJO_EDICION);
}
