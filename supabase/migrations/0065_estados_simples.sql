-- ============================================================================
-- 0065_estados_simples.sql
-- Los estados de la orden pasan a ser cuatro mientras el equipo está en el
-- taller, más "entregada" (lib/estados.ts, decisión de Frank 2026-10-22):
--
--   recibida, en_diagnostico, en_reparacion  -> en_proceso
--   esperando_repuesto                       -> falta_repuesto
--   esperando_aprobacion, rechazada          -> esperando_cliente
--   listo_entrega, entregada                 -> sin cambio
--
-- El historial (orden_evento) no se toca: sigue diciendo lo que pasó con
-- los nombres de entonces, y la app los sigue mostrando así.
--
-- Las subfases (fase_orden, 0050) se ocultan: la tabla y sus filas se
-- quedan, pero ninguna orden queda apuntando a una.
-- ============================================================================

update orden set estado = 'en_proceso'
  where estado in ('recibida', 'en_diagnostico', 'en_reparacion');
update orden set estado = 'falta_repuesto'   where estado = 'esperando_repuesto';
update orden set estado = 'esperando_cliente' where estado in ('esperando_aprobacion', 'rechazada');

update orden set fase_id = null where fase_id is not null;

alter table orden alter column estado set default 'en_proceso';

alter table orden drop constraint if exists orden_estado_check;
alter table orden add constraint orden_estado_check check (estado in (
  'en_proceso', 'falta_repuesto', 'esperando_cliente', 'listo_entrega', 'entregada'));
