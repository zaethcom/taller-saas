-- ============================================================================
-- 0044_repuesto_en_venta.sql
-- Un repuesto puede seguir en el catálogo (para consumirlo en una orden,
-- para el historial, para los informes) sin ofrecerse en el mostrador.
-- /vender solo muestra los que están en venta Y tienen existencia en la
-- sede activa; sin esta marca el carrito se llenaba de repuestos que no
-- se venden sueltos.
--
-- Default true: todo lo que ya existe sigue a la venta como hasta hoy, y
-- el administrador apaga a mano lo que no quiere ver en /vender.
-- ============================================================================

alter table repuesto
  add column en_venta boolean not null default true;
