-- ============================================================================
-- 0052_servicio_empresa.sql
-- Hasta cuándo tiene pago el servicio cada empresa. Se contrata por
-- meses: el superadmin registra un pago de N meses y la fecha de fin se
-- corre N meses. El listado de /superadmin/empresas avisa de las
-- vencidas y de las que vencen pronto.
--
-- Vencer NO bloquea nada por sí solo: el corte sigue siendo
-- empresa.activa (0020), que el superadmin decide a mano. Así un pago
-- que llega un día tarde no deja a un taller sin trabajar.
-- ============================================================================

alter table empresa add column servicio_inicio date;
alter table empresa add column servicio_fin date;

-- Cada pago queda registrado, no solo la fecha resultante: si alguien
-- pregunta "¿cuándo pagó y por cuánto?", la respuesta está aquí.
create table pago_servicio (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa(id) on delete cascade,
  fecha_pago      date not null default current_date,
  meses           int not null check (meses between 1 and 60),
  valor           numeric(14,2),
  desde           date not null,
  hasta           date not null,
  nota            text,
  registrado_por  uuid references superadmin(id) on delete set null,
  creado_en       timestamptz not null default now(),
  check (hasta > desde)
);

create index on pago_servicio (empresa_id, fecha_pago desc);

-- Solo el superadmin la usa, siempre con service_role (se salta RLS).
-- RLS encendida y sin policies: ningún usuario de una empresa la ve.
alter table pago_servicio enable row level security;
