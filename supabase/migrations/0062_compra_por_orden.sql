-- ============================================================================
-- 0062_compra_por_orden.sql
-- Lo que Compras pide para una orden llega para esa orden y no entra al
-- inventario. Al marcarlo recibido se anota el producto que de verdad
-- llegó y cuánto costó (dato interno, para la contabilidad de la orden:
-- gastado, cobrado y utilidad), y el técnico recibe un aviso
-- (lib/compras/recepcion-orden.ts).
-- ============================================================================

alter table repuesto_solicitud
  add column producto      text,
  add column costo_compra  numeric(12,2),
  add column recibido_por  uuid references perfil(id);

-- El aviso "llegó el repuesto" va al globo y por push al técnico.
alter table aviso drop constraint if exists aviso_tipo_check;
alter table aviso add constraint aviso_tipo_check check (tipo in (
  'mensaje', 'cotizacion_aprobada', 'cotizacion_rechazada',
  'item_aprobado', 'item_rechazado', 'repuesto_recibido'));
