-- ============================================================================
-- 0055_listo_entrega.sql
-- Nuevo estado de la orden, "listo_entrega" (lib/estados.ts): el técnico
-- terminó, verificó el trabajo y el equipo espera a que lo recojan.
-- orden.estado es texto libre y no necesita cambio; fase_orden repite la
-- lista de estados en su check (0050_fase_orden.sql) y hay que sumarlo
-- para que también admita subfases.
-- ============================================================================

alter table fase_orden drop constraint if exists fase_orden_estado_check;
alter table fase_orden add constraint fase_orden_estado_check check (estado in (
  'recibida','en_diagnostico','esperando_aprobacion','en_reparacion',
  'esperando_repuesto','listo_entrega','rechazada','entregada'));
