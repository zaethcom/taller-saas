/**
 * Recepción de equipo: crea la orden, el producto si es nuevo, imprime
 * el comprobante con QR (comprobante.ts) y la etiqueta (etiqueta.ts),
 * y puede cobrar un anticipo con /api/ventas (tipo: "anticipo").
 *
 * Server Component a propósito: la Fase 3 del plano construye este
 * formulario completo -- cliente, producto, motivo -- contra
 * POST /api/ordenes (todavía no escrita). Este archivo deja el lugar
 * y la forma exactos donde va, en vez de simularlo con datos falsos.
 */
export default function PaginaRecibir() {
  return (
    <div>
      <h1>Recibir equipo</h1>
      <p style={{ opacity: 0.7 }}>
        Formulario de recepción: buscar o crear cliente, registrar el equipo, escribir el motivo,
        generar el serial. Al guardar: imprime comprobante + etiqueta y crea la orden en estado
        &quot;recibida&quot;. Ver Fase 3 del plano de construcción.
      </p>
    </div>
  );
}
