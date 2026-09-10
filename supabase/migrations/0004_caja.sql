-- ============================================================================
-- 0004_caja.sql
-- El dinero, en las dos sedes. El taller cobra dos cosas que la tienda no:
-- anticipos al recibir el equipo, y el saldo del servicio al entregarlo.
-- ============================================================================

create table turno_caja (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresa(id),
  sede_id          uuid not null references sede(id),
  abierto_por      uuid not null references perfil(id),
  base_inicial     numeric(12,2) not null default 0,
  abierto_en       timestamptz not null default now(),
  cerrado_por      uuid references perfil(id),
  efectivo_contado numeric(12,2),
  diferencia       numeric(12,2),   -- lo que sobró o faltó
  cerrado_en       timestamptz
);

create index on turno_caja (sede_id, cerrado_en);

create table venta (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  sede_id      uuid not null references sede(id),
  turno_id     uuid not null references turno_caja(id),
  orden_id     uuid references orden(id),   -- si cobra un servicio
  cliente_id   uuid references cliente(id),
  tipo         text not null check (tipo in ('mostrador','servicio','anticipo')),
  numero       serial,
  total        numeric(12,2) not null,
  anulada      boolean not null default false,
  creada_por   uuid not null references perfil(id),
  creada_en    timestamptz not null default now()
);

create index on venta (empresa_id, turno_id);
create index on venta (orden_id);

create table venta_item (
  id            uuid primary key default gen_random_uuid(),
  venta_id      uuid not null references venta(id) on delete cascade,
  repuesto_id   uuid,
  descripcion   text not null,
  cantidad      int not null,
  precio_unit   numeric(12,2) not null
);

create table pago (
  id       uuid primary key default gen_random_uuid(),
  venta_id uuid not null references venta(id) on delete cascade,
  medio    text not null check (medio in ('efectivo','transferencia','tarjeta')),
  monto    numeric(12,2) not null
);

-- Toda apertura del cajón queda registrada, tenga venta o no.
-- Un botón de abrir cajón sin bitácora es una invitación al descuadre.
create table apertura_cajon (
  id           bigserial primary key,
  empresa_id   uuid not null references empresa(id),
  sede_id      uuid not null references sede(id),
  turno_id     uuid references turno_caja(id),
  venta_id     uuid references venta(id),   -- nulo = apertura manual
  motivo       text,
  autor_id     uuid not null references perfil(id),
  ocurrio_en   timestamptz not null default now()
);

-- ── Inventario, para que "consumir repuesto" y "faltante" tengan de dónde
--    descontar. Por sede, para permitir traslados más adelante. ──
create table repuesto (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  codigo       text not null,
  descripcion  text not null,
  precio_venta numeric(12,2) not null default 0,
  unique (empresa_id, codigo)
);

create table existencia (
  repuesto_id  uuid not null references repuesto(id) on delete cascade,
  sede_id      uuid not null references sede(id),
  cantidad     int not null default 0,
  empresa_id   uuid not null references empresa(id),
  primary key (repuesto_id, sede_id)
);

-- Consumir un repuesto en una orden lo descuenta del inventario de la
-- sede de esa orden. Una sola transacción: no puede quedar la orden
-- con el repuesto anotado y el inventario sin descontar.
create or replace function consumir_repuesto(
  p_repuesto_id uuid, p_orden_id uuid, p_cantidad int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sede_id uuid;
  v_empresa_id uuid;
begin
  select sede_id, empresa_id into v_sede_id, v_empresa_id
    from orden where id = p_orden_id and empresa_id = empresa_actual();

  if v_sede_id is null then
    raise exception 'orden % no encontrada en esta empresa', p_orden_id;
  end if;

  update existencia
     set cantidad = cantidad - p_cantidad
   where repuesto_id = p_repuesto_id
     and sede_id = v_sede_id
     and empresa_id = v_empresa_id;

  if not found then
    raise exception 'no hay existencia registrada de % en esta sede', p_repuesto_id;
  end if;
end;
$$;

select _aplica_rls_empresa('turno_caja');
select _aplica_rls_empresa('venta');
select _aplica_rls_empresa('apertura_cajon');
select _aplica_rls_empresa('repuesto');
select _aplica_rls_empresa('existencia');

alter table venta_item enable row level security;
create policy venta_item_de_mi_empresa on venta_item
  for all to authenticated
  using (exists (select 1 from venta v where v.id = venta_item.venta_id and v.empresa_id = empresa_actual()))
  with check (exists (select 1 from venta v where v.id = venta_item.venta_id and v.empresa_id = empresa_actual()));

alter table pago enable row level security;
create policy pago_de_mi_empresa on pago
  for all to authenticated
  using (exists (select 1 from venta v where v.id = pago.venta_id and v.empresa_id = empresa_actual()))
  with check (exists (select 1 from venta v where v.id = pago.venta_id and v.empresa_id = empresa_actual()));
