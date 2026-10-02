-- ============================================================================
-- 0036_orden_item.sql
-- Fase 5 del Plan 1 (ver PLAN.md): lo que REALMENTE se usó/hizo durante
-- la reparación, distinto de cotizacion_item (la propuesta enviada
-- antes de aprobar). Resuelve "se cotizaron 2, se usaron 3": la
-- cotización queda como histórico de lo propuesto, orden_item acumula
-- la realidad y es lo que finalmente se cobra.
--
-- orden.total se recalcula (nunca se edita a mano) con
-- lib/orden-total.ts::recalcularTotalOrden -- reemplaza a
-- cotizacion.total como la fuente de verdad de lo que se cobra.
-- ============================================================================

create table orden_item (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  orden_id     uuid not null references orden(id) on delete cascade,
  tipo         text not null check (tipo in ('repuesto', 'servicio', 'mano_obra')),
  repuesto_id  uuid references repuesto(id),
  servicio_id  uuid references servicio(id),
  mano_obra_id uuid references mano_obra(id),
  descripcion  text not null,      -- snapshot legible, mismo patrón que cotizacion_item
  cantidad     int not null default 1,
  precio_unit  numeric(12,2) not null,
  subtotal     numeric(12,2) not null,
  creado_por   uuid references perfil(id),
  creado_en    timestamptz not null default now()
);

create index on orden_item (orden_id);
select _aplica_rls_empresa('orden_item');

alter table orden add column total numeric(12,2) not null default 0;
