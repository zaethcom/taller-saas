-- ============================================================================
-- 0028_servicios_mano_obra.sql
-- Catálogos de servicios y mano de obra del taller (puntos 7 y 8 del
-- documento de requerimientos) -- hoy la cotización solo tiene líneas de
-- texto libre; esto le da al técnico algo de dónde elegir en vez de
-- escribir todo a mano cada vez. Mismo espíritu que `categoria` y
-- `metodo_pago`: catálogo simple por empresa, activo/inactivo en vez de
-- borrado real.
-- ============================================================================

create table servicio (
  id                      uuid primary key default gen_random_uuid(),
  empresa_id              uuid not null references empresa(id),
  codigo                  text,
  nombre                  text not null,
  descripcion             text,
  precio                  numeric(12,2) not null default 0,
  costo_estimado          numeric(12,2),
  tiempo_estimado_minutos int,
  activo                  boolean not null default true
);

select _aplica_rls_empresa('servicio');

create table mano_obra (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  nombre      text not null,
  precio      numeric(12,2) not null default 0,
  activo      boolean not null default true
);

select _aplica_rls_empresa('mano_obra');
