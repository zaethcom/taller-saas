-- ============================================================================
-- 0061_avisos_cliente.sql
-- Avisos al taller cuando el cliente hace algo desde el enlace de
-- seguimiento: escribe un mensaje, aprueba o rechaza la cotización, o
-- decide un costo adicional. Los muestra el globo de la barra superior
-- (componentes/ui/avisos.tsx) y, si el equipo lo activó, llegan como
-- notificación push (push_suscripcion + lib/avisos-servidor.ts).
--
-- Un aviso es del taller, no de una persona: el primero que lo atiende
-- (abre la orden, responde o lo marca leído) lo quita para todos.
-- ============================================================================

create table aviso (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresa(id),
  sede_id       uuid references sede(id),
  orden_id      uuid not null references orden(id) on delete cascade,
  tipo          text not null check (tipo in (
                  'mensaje', 'cotizacion_aprobada', 'cotizacion_rechazada',
                  'item_aprobado', 'item_rechazado')),
  texto         text not null,
  creado_en     timestamptz not null default now(),
  atendido_en   timestamptz,
  atendido_por  uuid references perfil(id)
);

create index on aviso (empresa_id, creado_en desc) where atendido_en is null;
create index on aviso (orden_id) where atendido_en is null;
select _aplica_rls_empresa('aviso');

-- Un navegador (celular o PC) que aceptó recibir notificaciones push.
-- sede_id = la sede activa en ese equipo al activarlas: solo le llegan
-- los avisos de esa sede (null = todas).
create table push_suscripcion (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  perfil_id   uuid not null references perfil(id) on delete cascade,
  sede_id     uuid references sede(id),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  creado_en   timestamptz not null default now()
);

create index on push_suscripcion (empresa_id);
select _aplica_rls_empresa('push_suscripcion');

-- Los mensajes del cliente de la última semana que nadie ha respondido
-- todavía (no hay un mensaje del taller después) arrancan como avisos.
insert into aviso (empresa_id, sede_id, orden_id, tipo, texto, creado_en)
select m.empresa_id, o.sede_id, m.orden_id, 'mensaje', left(m.texto, 300), m.creado_en
from orden_mensaje m
join orden o on o.id = m.orden_id
where m.autor_tipo = 'cliente'
  and m.creado_en > now() - interval '7 days'
  and not exists (
    select 1 from orden_mensaje r
    where r.orden_id = m.orden_id and r.autor_tipo = 'staff' and r.creado_en > m.creado_en
  );
