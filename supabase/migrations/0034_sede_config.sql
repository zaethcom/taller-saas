-- ============================================================================
-- 0034_sede_config.sql
-- Personalización de recibo por sede: una empresa con dos sedes puede
-- necesitar mostrar una dirección/teléfono distintos en cada una (son
-- físicamente dos locales), o incluso un logo distinto. `empresa_config`
-- sigue siendo el valor por defecto -- esta tabla solo guarda lo que se
-- SOBRESCRIBE para una sede en particular; cualquier campo en null cae
-- al de empresa_config (ver lib/impresion.ts).
-- ============================================================================

create table sede_config (
  sede_id          uuid primary key references sede(id) on delete cascade,
  empresa_id       uuid not null references empresa(id) on delete cascade,
  logo_url         text,
  recibo_direccion text,
  recibo_telefono  text,
  recibo_pie       text,
  actualizado_en   timestamptz not null default now()
);

select _aplica_rls_empresa('sede_config');

-- El logo de una sede vive en el mismo bucket público 'logos' que el de
-- la empresa (0021_empresa_config.sql), bajo el mismo primer segmento de
-- ruta (<empresa_id>/...) -- las políticas de ese bucket ya lo permiten
-- sin cambios, solo hace falta la convención de subcarpeta
-- (logos/<empresa_id>/sedes/<sede_id>/logo.<ext>, ver lib/subir-logo.ts).
