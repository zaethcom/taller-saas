/**
 * Las cuatro métricas de la Fase 8 del plano de construcción, instrumentadas
 * desde el primer commit del MVP:
 *   - tiempo de recepción por debajo de 3 minutos
 *   - % de órdenes con evidencia completa de entrada y salida
 *   - tiempo desde cotización enviada hasta aprobada
 *   - % de faltantes resueltos en menos de 48 horas
 * Sin esto, "funcionó" es una opinión -- ver Fase 8 del plano.
 */
export default function PaginaReportes() {
  return (
    <div>
      <h1>Reportes</h1>
      <p style={{ opacity: 0.7 }}>
        Las cuatro métricas de éxito del piloto se calculan sobre orden_evento
        y repuesto_solicitud una vez haya órdenes reales que medir.
      </p>
    </div>
  );
}
