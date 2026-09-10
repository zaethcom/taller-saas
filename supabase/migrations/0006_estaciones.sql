-- ============================================================================
-- 0006_estaciones.sql
-- Cada estación de impresión (el Android fijo de cada sede) se autentica
-- con una clave propia, no con una cuenta de usuario -- no tiene sesión,
-- no tiene rol, solo necesita leer y marcar trabajos de SU sede.
--
-- La clave se guarda hasheada, igual que una contraseña: si la tabla se
-- filtra, no se puede recuperar la clave original.
-- ============================================================================

create table estacion_credencial (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  sede_id      uuid not null references sede(id) unique,
  clave_hash   text not null,   -- sha256 en hexadecimal
  creada_en    timestamptz not null default now(),
  revocada_en  timestamptz
);

-- Nunca expuesta por RLS a usuarios normales: solo la toca el cliente
-- de servicio (service role) desde las rutas de la estación.
alter table estacion_credencial enable row level security;
-- Sin policies para 'authenticated': ningún usuario de la app puede
-- leerla ni escribirla, ni siquiera el admin de su propia empresa.

create or replace function verificar_clave_estacion(p_clave_hash text)
returns table (sede_id uuid, empresa_id uuid)
language sql security definer set search_path = public as $$
  select ec.sede_id, ec.empresa_id
    from estacion_credencial ec
   where ec.clave_hash = p_clave_hash
     and ec.revocada_en is null
$$;
