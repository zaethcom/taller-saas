/**
 * Consumir un repuesto contra el inventario de la sede, o marcarlo
 * como faltante -- lo que crea la fila en repuesto_solicitud que
 * aparece en /admin/compras. Fase 6 del plano de construcción.
 */
export default async function PaginaRepuestos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1>Repuestos</h1>
      <p style={{ opacity: 0.7 }}>
        Orden {id}. Consumir del inventario o marcar faltante -- Fase 6 del plano de construcción.
      </p>
    </div>
  );
}
