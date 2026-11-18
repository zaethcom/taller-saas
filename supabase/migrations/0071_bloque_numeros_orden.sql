-- 0071_bloque_numeros_orden.sql
--
-- Recibir equipos sin internet (plan sin internet, fase 4; decisión D2:
-- bloques de números reservados por equipo).
--
-- Cada equipo (PC, tablet, celular de mostrador) aparta, mientras tiene
-- internet, un bloque corto de números de orden de su empresa. Sin
-- conexión, Recibir le pone a la orden el siguiente número del bloque:
-- el número que se le dice al cliente y se escribe en el equipo es el
-- definitivo, y al volver internet la orden sube con ese mismo número.
--
-- Las órdenes hechas con internet siguen tomando el siguiente número de
-- la empresa, ahora saltando también los bloques apartados. Por eso
-- puede haber números sin usar (los que queden en un bloque) y números
-- que llegan después que otros más altos. Es lo que se aprobó en D2.

create table if not exists orden_numero_bloque (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id) on delete cascade,
  sede_id     uuid references sede(id) on delete set null,
  -- Identificador que el navegador genera y guarda (lib/sin-conexion/bloque-numeros.ts).
  equipo      text not null check (length(equipo) between 8 and 64),
  usuario_id  uuid references perfil(id) on delete set null,
  desde       int not null check (desde > 0),
  hasta       int not null,
  creado_en   timestamptz not null default now(),
  check (hasta >= desde)
);

create index if not exists orden_numero_bloque_empresa_hasta on orden_numero_bloque (empresa_id, hasta);
create index if not exists orden_numero_bloque_equipo on orden_numero_bloque (empresa_id, equipo, creado_en desc);

-- Solo lectura para los usuarios (como 0069): los bloques se crean
-- únicamente con reservar_bloque_orden(), que toma el candado de la
-- numeración. Si se pudieran insertar a mano, cualquiera podría hacer
-- que la base aceptara números arbitrarios.
alter table orden_numero_bloque enable row level security;
drop policy if exists orden_numero_bloque_de_mi_empresa on orden_numero_bloque;
create policy orden_numero_bloque_de_mi_empresa on orden_numero_bloque
  for select to authenticated
  using (empresa_id = empresa_actual());

-- Aparta los siguientes p_cantidad números de la empresa de quien llama.
create or replace function reservar_bloque_orden(p_equipo text, p_sede uuid, p_cantidad int)
returns orden_numero_bloque
language plpgsql security definer set search_path = public as $$
declare
  v_empresa uuid := empresa_actual();
  v_desde int;
  v_bloque orden_numero_bloque;
begin
  if v_empresa is null then
    raise exception 'sin empresa';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 50 then
    raise exception 'cantidad de números inválida';
  end if;

  -- El mismo candado que asignar_numero_orden(): nadie toma un número
  -- mientras se aparta el bloque.
  perform pg_advisory_xact_lock(hashtext('orden_numero:' || v_empresa::text));

  select greatest(
           coalesce((select max(numero) from orden where empresa_id = v_empresa), 0),
           coalesce((select max(hasta) from orden_numero_bloque where empresa_id = v_empresa), 0)
         ) + 1
    into v_desde;

  insert into orden_numero_bloque (empresa_id, sede_id, equipo, usuario_id, desde, hasta)
  values (v_empresa, p_sede, p_equipo, auth.uid(), v_desde, v_desde + p_cantidad - 1)
  returning * into v_bloque;
  return v_bloque;
end;
$$;

revoke execute on function reservar_bloque_orden(text, uuid, int) from public, anon;
grant execute on function reservar_bloque_orden(text, uuid, int) to authenticated;

-- La numeración de las órdenes: una orden que llega con un número de un
-- bloque de su empresa lo conserva (si ya está usado, la restricción
-- única orden_empresa_numero_unico lo rechaza). Cualquier otra toma el
-- siguiente número libre después de las órdenes y de los bloques.
create or replace function asignar_numero_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('orden_numero:' || new.empresa_id::text));

  if new.numero is not null and exists (
    select 1 from orden_numero_bloque b
    where b.empresa_id = new.empresa_id and new.numero between b.desde and b.hasta
  ) then
    return new;
  end if;

  select greatest(
           coalesce((select max(numero) from orden where empresa_id = new.empresa_id), 0),
           coalesce((select max(hasta) from orden_numero_bloque where empresa_id = new.empresa_id), 0)
         ) + 1
    into new.numero;
  return new;
end;
$$;

revoke execute on function asignar_numero_orden() from public;
