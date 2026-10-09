/**
 * Número para wa.me a partir del teléfono de un cliente. En el
 * directorio los celulares suelen guardarse sin indicativo
 * (3001234567), y wa.me necesita el número internacional: un celular
 * colombiano de 10 dígitos que empieza por 3 recibe el 57 delante; lo
 * demás se usa tal cual (ya trae indicativo o es de otro país).
 */
import { normalizarTelefonoWhatsapp } from "../compras/whatsapp";

export function numeroWhatsappCliente(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const digitos = normalizarTelefonoWhatsapp(telefono);
  if (!digitos) return null;
  return digitos.length === 10 && digitos.startsWith("3") ? `57${digitos}` : digitos;
}

export function mensajeInicialCliente(nombre: string): string {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? "";
  return primerNombre ? `Hola ${primerNombre}, ` : "Hola, ";
}
