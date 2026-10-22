/**
 * "Enviar por WhatsApp" de la orden (CabeceraOrden): a qué número va el
 * enlace de seguimiento y con qué mensaje precargado. Mismo enfoque que
 * /clientes y /compras: wa.me con el texto escrito, sin cuenta de Meta.
 *
 * El número alternativo (0054_orden_telefono_alterno.sql) gana sobre el
 * teléfono del cliente: en un taller de celulares el cliente deja su
 * propio teléfono, y por ese número no contesta.
 */
import { numeroWhatsappCliente } from "./clientes/whatsapp";

export type DestinoWhatsapp = "alterno" | "cliente";

export function destinoWhatsappOrden(
  telefonoAlterno: string | null | undefined,
  telefonoCliente: string | null | undefined,
): { numero: string; destino: DestinoWhatsapp } | null {
  const alterno = numeroWhatsappCliente(telefonoAlterno);
  if (alterno) return { numero: alterno, destino: "alterno" };
  const cliente = numeroWhatsappCliente(telefonoCliente);
  if (cliente) return { numero: cliente, destino: "cliente" };
  return null;
}

/**
 * El mensaje depende del estado: si la orden espera aprobación, se le
 * pide autorizar; si no, que revise cómo va el equipo.
 */
export function mensajeSeguimiento({
  nombre,
  estado,
  equipo,
  empresa,
  url,
}: {
  nombre: string;
  estado: string;
  equipo?: string | null;
  empresa?: string | null;
  url: string;
}): string {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? "";
  const saludo = primerNombre ? `Hola ${primerNombre}` : "Hola";
  const deParte = empresa?.trim() ? `, te escribimos de ${empresa.trim()}` : "";
  const tuEquipo = equipo?.trim() ? `tu equipo ${equipo.trim()}` : "tu equipo";

  if (estado === "esperando_cliente") {
    return `${saludo}${deParte}. ${capitalizar(tuEquipo)} necesita tu autorización para continuar. Revisa el diagnóstico y la cotización, y apruébala aquí: ${url}`;
  }
  if (estado === "listo_entrega") {
    return `${saludo}${deParte}. ${capitalizar(tuEquipo)} ya está listo para recoger. Aquí ves el detalle y el saldo: ${url}`;
  }
  if (estado === "entregada") {
    return `${saludo}${deParte}. Aquí puedes ver el historial de ${tuEquipo}: ${url}`;
  }
  return `${saludo}${deParte}. Por favor revisa cómo va ${tuEquipo} en este enlace: ${url}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
