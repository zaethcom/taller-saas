/**
 * El técnico registra hallazgos y arma la cotización (repuestos + mano
 * de obra), y la envía por WhatsApp con el enlace que usa
 * /(publico)/seguimiento/[token] -- Fase 5 del plano de construcción.
 */
export default async function PaginaDiagnostico({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <h1>Diagnóstico y cotización</h1>
      <p style={{ opacity: 0.7 }}>
        Orden {id}. Hallazgos, repuestos y mano de obra -- Fase 5 del plano de construcción.
      </p>
    </div>
  );
}
