-- ============================================================================
-- 0057_acceso_pin_contrasena.sql
-- Acceso del equipo al recibirlo: PIN de cualquier largo ('pin'), Patrón,
-- Contraseña ('contrasena', texto libre) y Otros ('otro', describe el
-- método). 'pin3', 'pin4' y 'pin6' siguen válidos para las órdenes que ya
-- los tienen guardados.
-- ============================================================================

alter table orden_acceso drop constraint if exists orden_acceso_tipo_check;
alter table orden_acceso add constraint orden_acceso_tipo_check
  check (tipo in ('pin', 'pin3', 'pin4', 'pin6', 'patron', 'contrasena', 'otro'));
