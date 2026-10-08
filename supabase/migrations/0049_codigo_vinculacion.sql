-- ============================================================================
-- 0049_codigo_vinculacion.sql
-- Vincular la app Android del puente con un código corto, sin computador.
--
-- Hasta aquí, la única forma de darle a un equipo su clave de estación era
-- descargar un config.json y copiarlo a una carpeta: sirve para un PC, pero
-- no para la app del puente en el Android, donde no hay a dónde copiarlo.
--
-- Ahora /sedes muestra un código corto (8 letras/números, vence en 15
-- minutos, sirve una sola vez); se escribe en la app, la app lo canjea en
-- POST /api/estacion/vincular y recibe ahí su clave de estación. La clave
-- sigue siendo la misma estacion_credencial de 0006/0047 -- el código solo
-- es la forma de entregarla sin copiar archivos.
-- ============================================================================

create table if not exists estacion_codigo (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  -- Un código sin usar no debe impedir borrar una sede (ver DELETE
  -- /api/sedes/<id>): se va con ella.
  sede_id      uuid not null references sede(id) on delete cascade,
  -- sha256 en hexadecimal, igual que la clave: si la tabla se filtra, los
  -- códigos vigentes no se pueden usar.
  codigo_hash  text not null unique,
  creado_por   uuid references perfil(id),
  creado_en    timestamptz not null default now(),
  expira_en    timestamptz not null,
  usado_en     timestamptz
);

create index if not exists estacion_codigo_sede on estacion_codigo (sede_id);

-- Igual que estacion_credencial: RLS sin policies. Solo lo toca el cliente
-- de servicio desde las rutas de /api, nunca un usuario directo.
alter table estacion_codigo enable row level security;
