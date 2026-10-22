-- ============================================================================
-- 0064_encargo_cobro.sql
-- Un encargo de mostrador (0063) tiene valor para el cliente, puede
-- llevar abono al pedirlo y se cobra el saldo al entregarlo. Cada pago
-- es una venta tipo 'encargo' ligada al encargo (entra al turno de caja
-- como cualquier venta) con su recibo impreso (lib/compras/encargo.ts).
-- ============================================================================

alter table repuesto_solicitud
  add column precio_venta  numeric(12,2),
  add column entregado_en  timestamptz;

alter table venta
  add column solicitud_id uuid references repuesto_solicitud(id);
create index on venta (solicitud_id) where solicitud_id is not null;

alter table venta drop constraint if exists venta_tipo_check;
alter table venta add constraint venta_tipo_check
  check (tipo in ('mostrador', 'servicio', 'anticipo', 'encargo'));
