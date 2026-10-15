/**
 * Arma el mensaje y el enlace wa.me con los faltantes elegidos en
 * /compras. Sin backend ni cuenta de negocio de Meta: el navegador abre
 * WhatsApp con el texto ya escrito y la persona lo envía.
 */

export interface LineaPedido {
  descripcion: string;
  cantidad: number;
  ordenNumero: number | null | undefined;
  prioridad: string;
  /** Para qué equipo es: tipo, marca y modelo (ver equipoTexto). */
  equipo?: string;
}

/** "Patineta Xiaomi M365 Pro": lo que el proveedor necesita para saber qué repuesto mandar. */
export function equipoTexto(
  producto: { tipo?: string | null; marca?: string | null; modelo?: string | null } | null | undefined,
): string {
  if (!producto) return "";
  const tipo = producto.tipo ? producto.tipo.charAt(0).toUpperCase() + producto.tipo.slice(1) : null;
  return [tipo, producto.marca, producto.modelo]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

/** Solo dígitos; null si no alcanza para ser un número de teléfono. */
export function normalizarTelefonoWhatsapp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length >= 7 ? digitos : null;
}

export function mensajePedido(lineas: LineaPedido[], destinatario?: string): string {
  const encabezado = destinatario ? `Hola ${destinatario}, pedido de repuestos:` : "Pedido de repuestos:";
  const cuerpo = lineas.map((l) => {
    const detalle = [l.ordenNumero ? `orden #${l.ordenNumero}` : null, `prioridad ${l.prioridad}`]
      .filter(Boolean)
      .join(", ");
    const para = l.equipo ? ` para ${l.equipo}` : "";
    return `• ${l.descripcion} x${l.cantidad}${para} (${detalle})`;
  });
  return `${encabezado}\n${cuerpo.join("\n")}`;
}

export function enlaceWhatsapp(telefono: string, texto: string): string {
  const numero = telefono.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
