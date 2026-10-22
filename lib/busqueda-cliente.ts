/**
 * Reglas para encontrar un cliente ya registrado al recibir un equipo,
 * por documento o por teléfono. Usa la misma normalización que el
 * buscador de órdenes (lib/busqueda-orden.ts): documentos y teléfonos se
 * guardan como los escribió quien recibió ("1.023.456.789",
 * "+57 300-123-4567"), así que se comparan solo por sus dígitos/letras.
 */
import {
  MIN_CARACTERES_DOCUMENTO,
  coincideDocumento,
  digitosTelefono,
  normalizarDocumento,
} from "./busqueda-orden";

export interface ClienteBuscado {
  id: string;
  nombre: string;
  documento: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface ClienteEncontrado extends ClienteBuscado {
  coincide: "documento" | "telefono" | "nombre";
}

/** Lo escrito alcanza para buscar como documento o como teléfono. */
export function sePuedeBuscarCliente(texto: string): boolean {
  return normalizarDocumento(texto).length >= MIN_CARACTERES_DOCUMENTO || digitosTelefono(texto) !== null;
}

/**
 * Un celular colombiano (10 dígitos que empiezan por 3, con o sin +57):
 * si no aparece nadie, lo escrito se guarda como teléfono del cliente
 * nuevo y no como documento.
 */
export function pareceCelular(texto: string): boolean {
  const d = digitosTelefono(texto);
  return d !== null && d.length === 10 && d.startsWith("3") && /^[\d\s+().-]+$/.test(texto.trim());
}

/**
 * Aquí el teléfono tiene que ser el mismo número completo (con o sin
 * +57), no solo terminar igual como en el buscador de órdenes: el cliente
 * encontrado llena el formulario solo, y una cédula de 7 dígitos no debe
 * traer a alguien cuyo celular termina en esos dígitos.
 */
export function mismoTelefono(guardado: string | null | undefined, buscado: string): boolean {
  return digitosTelefono(guardado ?? "") === buscado;
}

/**
 * De las filas que trajo el primer filtro de la base, las que de verdad
 * coinciden. Primero las que coinciden por documento (es único por
 * persona); sin repetir clientes.
 */
export function clientesCoincidentes(filas: ClienteBuscado[], texto: string): ClienteEncontrado[] {
  const documento = normalizarDocumento(texto);
  const telefono = digitosTelefono(texto);
  const porDocumento: ClienteEncontrado[] = [];
  const porTelefono: ClienteEncontrado[] = [];
  const vistos = new Set<string>();
  for (const f of filas) {
    if (documento.length >= MIN_CARACTERES_DOCUMENTO && coincideDocumento(f.documento, documento)) {
      if (!vistos.has(f.id)) porDocumento.push({ ...f, coincide: "documento" });
      vistos.add(f.id);
    }
  }
  for (const f of filas) {
    if (telefono && !vistos.has(f.id) && mismoTelefono(f.telefono, telefono)) {
      porTelefono.push({ ...f, coincide: "telefono" });
      vistos.add(f.id);
    }
  }
  return [...porDocumento, ...porTelefono];
}
