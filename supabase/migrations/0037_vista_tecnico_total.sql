-- ============================================================================
-- 0037_vista_tecnico_total.sql
-- El hub y CabeceraOrden necesitan mostrar orden.total corriendo (Fase
-- 5 del Plan 1) -- hoy no se muestra en ningún lado. token_publico va
-- al final por la misma razón de siempre: CREATE OR REPLACE VIEW no
-- deja insertar columnas en medio de la lista existente.
-- ============================================================================

create or replace view orden_para_tecnico as
select
  o.id, o.empresa_id, o.numero, o.estado, o.motivo, o.abierta_en, o.tecnico_id,
  p.serial, p.tipo, p.marca, p.modelo,
  c.nombre as cliente_nombre,
  o.token_publico,
  o.total
from orden o
  join producto p on p.id = o.producto_id
  join cliente  c on c.id = p.cliente_id;

alter view orden_para_tecnico set (security_invoker = true);
