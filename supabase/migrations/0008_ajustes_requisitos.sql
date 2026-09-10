-- ============================================================================
-- 0008_ajustes_requisitos.sql
-- Dos columnas que faltaban para poder verificar de verdad los
-- requisitos de lib/estados.ts contra datos reales, en vez de asumirlos:
--
--   - evidencia necesita distinguir foto de ENTRADA de foto de SALIDA
--     (REQUISITOS.en_diagnostico pide la primera, REQUISITOS.entregada
--     la segunda) y necesita poder guardar la firma de quien recibe.
--   - trabajo_impresion necesita saber de qué orden es una etiqueta,
--     para poder verificar tiene_etiqueta.
-- ============================================================================

alter table evidencia
  drop constraint evidencia_tipo_check,
  add constraint evidencia_tipo_check check (tipo in ('foto', 'video', 'firma'));

alter table evidencia
  add column fase text check (fase in ('entrada', 'salida'));

alter table trabajo_impresion
  add column orden_id uuid references orden(id);

create index on trabajo_impresion (orden_id) where tipo = 'etiqueta_qr';
