-- ============================================================================
-- 0051_ajustes_etiquetadora.sql
-- Ajustes de la etiquetadora de cada sede (oscuridad, velocidad, sensor,
-- corrimientos), elegidos desde Configurar impresoras en /sedes. Se mandan
-- dentro de cada etiqueta (estacion/ajustes-etiquetadora.ts). Vacío = no
-- se manda nada y la impresora sigue con lo que tenga configurado.
-- ============================================================================

alter table impresora_sede
  add column etiquetas_ajustes jsonb not null default '{}'::jsonb;
