-- ============================================================================
-- 0038_orden_acceso.sql
-- Fase A2 del Plan 3: PIN/patrón de desbloqueo del equipo, capturado al
-- recibirlo cuando el servicio lo necesita.
--
-- Es por ORDEN, no por producto: un PIN puede cambiar entre una visita
-- y la siguiente, y una fila permanente en `producto` mostraría un PIN
-- viejo en la segunda reparación del mismo equipo.
-- ============================================================================

create table orden_acceso (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  orden_id    uuid not null unique references orden(id) on delete cascade,
  tipo        text check (tipo in ('pin3', 'pin4', 'pin6', 'patron', 'otro')),
  valor       text,   -- dígitos o patrón ("1-2-5-8-9"); nunca se cifra -- mismo
                       -- nivel de protección que servicioClave hoy (RLS +
                       -- ruta server-only), no una encriptación nueva que
                       -- nadie pidió
  nota        text,
  creado_por  uuid references perfil(id),
  creado_en   timestamptz not null default now()
);

select _aplica_rls_empresa('orden_acceso');

-- REGLA DURA para quien toque esta tabla después: `valor` nunca se lee
-- con un .from("orden_acceso").select() desde el navegador, ni siquiera
-- protegido por la RLS de arriba -- esa RLS aísla por empresa, no
-- decide quién ADENTRO de la empresa puede ver el PIN de un cliente.
-- La única lectura válida es GET /api/ordenes/[id]/acceso, que valida
-- el rol server-side (lib/permisos.ts, accion "ver_acceso_dispositivo")
-- antes de devolver `valor`.
comment on column orden_acceso.valor is
  'Nunca leer desde el navegador -- solo vía GET /api/ordenes/[id]/acceso, gateado por puede(rol, "ver_acceso_dispositivo").';
