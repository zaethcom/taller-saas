/**
 * Abrir y cerrar el turno de caja. Cerrar calcula la diferencia con
 * lib/caja.ts (calcularDiferencia) y encola el comprobante de cierre
 * (plantillas/cierre.ts). Ver Fase 7 del plano de construcción.
 */
export default function PaginaTurno() {
  return (
    <div>
      <h1>Turno de caja</h1>
      <p style={{ opacity: 0.7 }}>
        Abrir: registrar la base inicial. Cerrar: contar el efectivo, comparar contra
        efectivoEsperado() de lib/caja.ts, e imprimir el comprobante con la diferencia.
      </p>
    </div>
  );
}
