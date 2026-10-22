-- ============================================================================
-- 0063_encargos_compras.sql
-- Desde Vender se encarga lo que un cliente de mostrador pide y no hay
-- (componentes/cobro/encargo-compras.tsx). Va a la misma lista de
-- Compras que lo que piden las órdenes, pero sin orden: lleva el nombre
-- y el teléfono de a quién hay que traérselo (lib/compras/encargo.ts).
-- ============================================================================

alter table repuesto_solicitud
  add column cliente_id        uuid references cliente(id),
  add column cliente_nombre    text,
  add column cliente_telefono  text,
  add column sede_id           uuid references sede(id);

-- Un pedido es para una orden o para un cliente con teléfono.
alter table repuesto_solicitud alter column orden_id drop not null;
alter table repuesto_solicitud add constraint repuesto_solicitud_para_quien
  check (orden_id is not null or cliente_telefono is not null);
