-- ============================================================================
-- 0020_superadmin.sql
-- La capa de SaaS multiempresa: quien crea y administra empresas desde
-- fuera del aislamiento normal.
--
-- Deliberadamente NO es una fila de `perfil` con un rol nuevo. `perfil`
-- modela "empleado de una empresa" -- empresa_id not null, RLS que
-- exige empresa_actual(). Un superadmin no es empleado de ninguna
-- empresa; forzarlo dentro de `perfil` habría significado o bien
-- asignarle una empresa arbitraria (mentira conceptual) o relajar el
-- not null / la RLS de la tabla que sostiene el aislamiento de todo el
-- negocio. Una tabla aparte dejó esa base intacta.
-- ============================================================================

create table superadmin (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

alter table superadmin enable row level security;

-- Un superadmin puede leer su PROPIA fila -- así el login sabe que lo es.
-- No hay policy de insert/update/delete para authenticated, a propósito:
-- crear un superadmin nuevo es un acto fuera de la aplicación (SQL
-- directo o el cliente de service_role), nunca un POST que la propia
-- app pueda exponer.
create policy superadmin_ve_su_propia_fila on superadmin
  for select to authenticated
  using (id = auth.uid());

-- Suspender una empresa (impago, baja, lo que sea) debe cortar el
-- acceso de raíz, no ser una bandera que cada pantalla tendría que
-- acordarse de revisar. empresa_actual() es la función de la que
-- depende CADA policy de CADA tabla del negocio (0002_rls.sql) -- basta
-- con que dependa también de empresa.activa para que una empresa
-- suspendida deje de ver absolutamente nada, en todas partes, de
-- inmediato.
alter table empresa add column activa boolean not null default true;

create or replace function empresa_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select p.empresa_id
  from perfil p
  join empresa e on e.id = p.empresa_id
  where p.id = auth.uid() and p.activo and e.activa
$$;
