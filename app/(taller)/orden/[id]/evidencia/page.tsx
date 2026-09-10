/**
 * Captura de fotos desde la cámara de la tablet, comprimidas antes de
 * subir, con cola en IndexedDB para cuando no hay señal -- ver offline/
 * y la Fase 4 del plano de construcción. Sube a Storage con la ruta
 * evidencia/<empresa_id>/<orden_id>/<archivo> (0007_storage.sql) y
 * registra la fila en `evidencia` con fase: 'entrada' | 'salida'.
 */
export default async function PaginaEvidencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1>Evidencia</h1>
      <p style={{ opacity: 0.7 }}>
        Orden {id}. Captura de fotos con cola sin conexión -- Fase 4 del plano de construcción.
      </p>
    </div>
  );
}
