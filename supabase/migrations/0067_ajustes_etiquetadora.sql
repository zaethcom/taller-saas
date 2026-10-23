-- ============================================================================
-- 0067_ajustes_etiquetadora.sql
-- Ajustes de la etiquetadora de cada sede (oscuridad, velocidad, avance al
-- terminar, sensor, método, corrimientos, giro), elegidos desde Sedes →
-- Configurar impresoras. Se mandan dentro de cada etiqueta
-- (estacion/ajustes-etiquetadora.ts). Vacío = no se manda nada y la
-- impresora sigue con lo que tenga configurado.
-- (Retoma la 0051 del PR #62, que nunca se aplicó.)
-- ============================================================================

alter table impresora_sede
  add column if not exists etiquetas_ajustes jsonb not null default '{}'::jsonb;
