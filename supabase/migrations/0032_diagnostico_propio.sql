-- ============================================================================
-- 0032_diagnostico_propio.sql
-- El diagnóstico deja de ser un `nota` de texto libre que viaja como
-- side-effect de enviar la cotización -- ahora es su propio paso, con
-- sus propios campos (punto 3 del documento de trazabilidad del
-- taller). Un diagnóstico por orden: se edita mientras la orden esté en
-- 'en_diagnostico', igual que antes solo se podía escribir una vez.
--
-- También se agregan a cotizacion_item las referencias opcionales al
-- catálogo (repuesto/servicio/mano_obra) que la Fase 3 va a necesitar
-- -- nulas significa línea de texto libre, la opción que el usuario
-- pidió mantener para cargos puntuales.
-- ============================================================================

create table diagnostico (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa(id),
  orden_id        uuid not null unique references orden(id) on delete cascade,
  hallazgos       text,
  fallas          text,
  observaciones   text,
  recomendaciones text,
  creado_por      uuid references perfil(id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

select _aplica_rls_empresa('diagnostico');

alter table cotizacion_item
  add column repuesto_id  uuid references repuesto(id),
  add column servicio_id  uuid references servicio(id),
  add column mano_obra_id uuid references mano_obra(id);
