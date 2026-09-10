-- ============================================================================
-- 0009_orden_repuesto.sql
-- Registra qué repuesto y cuánto consumió cada orden -- distinto de
-- cotizacion_item (el estimado que se le cotiza al cliente) y de
-- venta_item (una venta de mostrador). Esto es lo físico: lo que
-- realmente salió de la bodega para reparar este equipo. Sin esta
-- tabla, "consumir un repuesto" descontaba el inventario pero no
-- dejaba rastro de para qué orden fue.
-- ============================================================================

create table orden_repuesto (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresa(id),
  orden_id      uuid not null references orden(id) on delete cascade,
  repuesto_id   uuid not null references repuesto(id),
  cantidad      int not null check (cantidad > 0),
  consumido_por uuid references perfil(id),
  consumido_en  timestamptz not null default now()
);

create index on orden_repuesto (orden_id);

select _aplica_rls_empresa('orden_repuesto');
