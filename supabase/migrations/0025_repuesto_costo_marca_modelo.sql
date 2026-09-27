-- ============================================================================
-- 0025_repuesto_costo_marca_modelo.sql
-- El catálogo de un taller de celulares (Celutec) trae por repuesto un
-- costo de compra, la marca y el modelo/compatibilidad, y una
-- observación de calidad o garantía -- ninguno tenía dónde vivir en
-- `repuesto`, así que se habría perdido al importar o quedado enterrado
-- en el texto de `descripcion`. Los cuatro son opcionales: el catálogo
-- ya existente (seed.sql, Team Polaco Scooter) no los tiene y sigue
-- funcionando igual.
--
-- Con costo, el margen de un repuesto es precio_venta - costo (y en
-- porcentaje, (precio_venta - costo) / precio_venta * 100) -- no se
-- guarda calculado; se deriva donde haga falta.
-- ============================================================================

alter table repuesto
  add column costo       numeric(12,2),
  add column marca       text,
  add column modelo      text,
  add column observacion text;
