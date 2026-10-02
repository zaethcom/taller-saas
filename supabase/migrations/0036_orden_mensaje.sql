-- ============================================================================
-- 0036_orden_mensaje.sql
-- Fase F3 del Plan 3: mensajería cliente <-> taller en el enlace de
-- seguimiento (punto 8 del documento del cliente). Async, "pull" --
-- cada lado revisa al entrar, sin notificaciones push (decisión
-- confirmada con el cliente) -- consistente con que WhatsApp sigue
-- siendo un stub a propósito (lib/mensajeria/whatsapp.ts).
-- ============================================================================

create table orden_mensaje (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  orden_id    uuid not null references orden(id) on delete cascade,
  autor_tipo  text not null check (autor_tipo in ('cliente', 'staff')),
  autor_id    uuid references perfil(id),  -- null cuando autor_tipo='cliente'
  texto       text not null,
  creado_en   timestamptz not null default now()
);

create index on orden_mensaje (orden_id, creado_en);
select _aplica_rls_empresa('orden_mensaje');
