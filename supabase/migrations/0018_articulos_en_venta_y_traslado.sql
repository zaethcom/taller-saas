-- ============================================================================
-- 0018_articulos_en_venta_y_traslado.sql
-- Cierra la trazabilidad de un artículo individualizado: hasta ahora
-- solo podía nacer (recepción, 0016) y viajar entre sedes en tránsito
-- (0014 solo conocía repuestos a granel). Le falta poder venderse, y
-- que el traslado también sepa mover una unidad, no solo una cantidad.
--
-- Una línea de venta o de traslado referencia repuesto_id O articulo_id,
-- nunca los dos -- son dos maneras distintas de salir del inventario,
-- no una tercera cosa combinada.
-- ============================================================================

alter table venta_item add column articulo_id uuid references articulo(id);
alter table venta_item add constraint venta_item_repuesto_xor_articulo
  check (repuesto_id is null or articulo_id is null);

-- repuesto_id era not null porque hasta ahora todo traslado era a
-- granel; con articulo_id como alternativa, una fila puede tener
-- cualquiera de los dos, nunca ninguno.
alter table traslado_item alter column repuesto_id drop not null;
alter table traslado_item add column articulo_id uuid references articulo(id);
alter table traslado_item add constraint traslado_item_repuesto_xor_articulo
  check ((repuesto_id is not null) <> (articulo_id is not null));
