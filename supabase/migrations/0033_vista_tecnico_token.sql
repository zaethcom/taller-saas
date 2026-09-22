-- ============================================================================
-- 0033_vista_tecnico_token.sql
-- La nueva cabecera compartida de la orden (Fase 4 del plan de
-- trazabilidad del taller) necesita el código de seguimiento para
-- armar el enlace "Copiar enlace" en cada pantalla del técnico, no
-- solo al enviar la cotización. token_publico no es sensible -- ya va
-- impreso en la etiqueta física que cualquiera puede leer -- así que
-- agregarlo a la vista que ya excluye los datos sensibles del cliente
-- no relaja nada.
-- ============================================================================

-- CREATE OR REPLACE VIEW solo permite agregar columnas al final de la
-- lista, no insertarlas en medio (Postgres lo trata como un intento de
-- renombrar las columnas siguientes) -- por eso token_publico va al
-- final y no junto a las demás columnas de `orden`.
create or replace view orden_para_tecnico as
select
  o.id, o.empresa_id, o.numero, o.estado, o.motivo, o.abierta_en, o.tecnico_id,
  p.serial, p.tipo, p.marca, p.modelo,
  c.nombre as cliente_nombre,
  o.token_publico
from orden o
  join producto p on p.id = o.producto_id
  join cliente  c on c.id = p.cliente_id;

alter view orden_para_tecnico set (security_invoker = true);
