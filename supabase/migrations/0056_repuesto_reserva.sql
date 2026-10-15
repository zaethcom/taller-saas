-- ============================================================================
-- 0056_repuesto_reserva.sql
-- Cuando el cliente aprueba la cotización, los repuestos cotizados que
-- hay en la sede quedan apartados para esa orden: otra venta u otra
-- orden ya no los cuenta como disponibles. La reserva no mueve
-- existencia (eso sigue pasando al consumir, vía mover_existencia):
-- solo dice cuánto de lo que hay ya tiene dueño.
--
-- activa -> consumida (el técnico usó el repuesto en la orden)
--        -> liberada  (la orden se entregó sin usarlo)
-- ============================================================================

create table repuesto_reserva (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  orden_id     uuid not null references orden(id) on delete cascade,
  repuesto_id  uuid not null references repuesto(id),
  sede_id      uuid not null references sede(id),
  cantidad     int not null check (cantidad > 0),
  estado       text not null default 'activa' check (estado in ('activa','consumida','liberada')),
  creada_en    timestamptz not null default now(),
  cerrada_en   timestamptz
);
select _aplica_rls_empresa('repuesto_reserva');

create index on repuesto_reserva (sede_id, repuesto_id) where estado = 'activa';
create index on repuesto_reserva (orden_id);
