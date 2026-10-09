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
    return `• ${l.descripcion} x${l.cantidad} (${detalle})`;
  });
  return `${encabezado}\n${cuerpo.join("\n")}`;
}

export function enlaceWhatsapp(telefono: string, texto: string): string {
  const numero = telefono.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
