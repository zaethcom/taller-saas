-- ============================================================================
-- 0013_recibido_en.sql
-- Faltaba el momento exacto en que un faltante se resuelve. Sin esto,
-- /api/repuesto-solicitud/[id]/recibir cambiaba el estado a 'recibido'
-- pero no dejaba cuándo -- y la métrica de la Fase 8 del plano
-- ("% de faltantes resueltos en menos de 48 horas") no se puede
-- calcular sin saber cuándo pasó, solo que pasó.
-- ============================================================================

alter table repuesto_solicitud
  add column recibido_en timestamptz;
