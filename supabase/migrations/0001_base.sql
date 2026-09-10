-- ============================================================================
-- 0001_base.sql
-- Las entidades centrales del negocio: empresa, sede, usuarios, cliente,
-- producto, orden de servicio y su historial de eventos.
--
-- Regla de todo el esquema: toda tabla del negocio lleva empresa_id.
-- Sin esa columna, la política de aislamiento de 0002_rls.sql no puede
-- protegerla.
-- ============================================================================

create extension if not exists pgcrypto;

create table empresa (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  nit          text,
  creada_en    timestamptz not null default now()
);

create table sede (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id) on delete cascade,
  nombre       text not null,
  tipo         text not null check (tipo in ('tienda','taller'))
);

-- Extiende auth.users de Supabase con lo que el negocio necesita.
-- El id es el mismo de auth.users: no hay tabla de usuarios propia.
create table perfil (
  id           uuid primary key references auth.users(id) on delete cascade,
  empresa_id   uuid not null references empresa(id),
  sede_id      uuid references sede(id),
  nombre       text not null,
  rol          text not null check (rol in ('admin','recepcion','tecnico','compras','cajero')),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table cliente (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  nombre       text not null,
  documento    text,
  telefono     text,
  correo       text,
  creado_en    timestamptz not null default now()
);

-- El equipo del cliente: la patineta, el celular. Vive entre visitas.
-- El serial es lo que el QR permanente codifica -- no cambia entre órdenes.
create table producto (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  cliente_id   uuid not null references cliente(id),
  serial       text not null,
  tipo         text not null,   -- 'patineta' | 'celular' | ...
  marca        text,
  modelo       text,
  creado_en    timestamptz not null default now(),
  unique (empresa_id, serial)
);

create table orden (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresa(id),
  sede_id        uuid not null references sede(id),
  producto_id    uuid not null references producto(id),
  numero         serial,
  estado         text not null default 'recibida',
  motivo         text not null,
  tecnico_id     uuid references perfil(id),
  token_publico  text not null unique default encode(gen_random_bytes(16), 'hex'),
  abierta_en     timestamptz not null default now(),
  cerrada_en     timestamptz
);

create index on orden (empresa_id, estado);
create index on orden (token_publico);

-- Una fila por cambio de estado. Nunca se edita ni se borra.
-- Es el historial que ve el cliente y la auditoría de la sección 7
-- del documento original, a la vez.
create table orden_evento (
  id           bigserial primary key,
  empresa_id   uuid not null references empresa(id),
  orden_id     uuid not null references orden(id) on delete cascade,
  de_estado    text,
  a_estado     text not null,
  autor_id     uuid references perfil(id),
  nota         text,
  ocurrio_en   timestamptz not null default now()
);

create index on orden_evento (orden_id, ocurrio_en);

create table evidencia (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa(id),
  orden_id        uuid not null references orden(id) on delete cascade,
  evento_id       bigint references orden_evento(id),
  ruta            text not null,   -- ruta en Storage, no el archivo
  tipo            text not null check (tipo in ('foto','video')),
  hash            text,            -- prueba de que no se alteró
  autor_id        uuid references perfil(id),
  visible_cliente boolean not null default false,
  tomada_en       timestamptz not null default now()
);

create table cotizacion (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  orden_id     uuid not null references orden(id) on delete cascade,
  mano_obra    numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  estado       text not null default 'borrador',
  enviada_en   timestamptz,
  decidida_en  timestamptz,
  decision     text check (decision in ('aprobada','rechazada')),
  decision_ip  inet   -- prueba de consentimiento del cliente
);

create table cotizacion_item (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizacion(id) on delete cascade,
  descripcion   text not null,
  cantidad      int not null default 1,
  precio_unit   numeric(12,2) not null
);

create table repuesto_solicitud (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa(id),
  orden_id        uuid not null references orden(id),
  descripcion     text not null,
  cantidad        int not null default 1,
  prioridad       text not null default 'normal',
  estado          text not null default 'faltante',
  -- faltante -> solicitado -> recibido -> consumido
  solicitado_por  uuid references perfil(id),
  creada_en       timestamptz not null default now()
);

create index on repuesto_solicitud (empresa_id, estado);
