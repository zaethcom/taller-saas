-- ============================================================================
-- 0003_vista_tecnico.sql
-- El técnico no ve los datos del cliente -- requisito de la sección 7 del
-- documento original. Se resuelve con una vista que sencillamente no
-- incluye las columnas sensibles: teléfono, correo y documento.
--
-- El técnico consulta esta vista, no la tabla `cliente` directamente.
-- ============================================================================

create view orden_para_tecnico as
select
  o.id, o.empresa_id, o.numero, o.estado, o.motivo, o.abierta_en, o.tecnico_id,
  p.serial, p.tipo, p.marca, p.modelo,
  c.nombre as cliente_nombre    -- el nombre sí, para saludar
  -- teléfono, correo y documento: fuera. El técnico no los necesita.
from orden o
  join producto p on p.id = o.producto_id
  join cliente  c on c.id = p.cliente_id;

-- Las vistas heredan RLS de las tablas base con security_invoker,
-- así que esta vista respeta el aislamiento por empresa automáticamente.
alter view orden_para_tecnico set (security_invoker = true);
