-- ============================================================================
-- 0035_tipo_negocio_info_adicional.sql
-- Fase A1 del Plan 3: qué tipo de equipo propone /recibir por defecto
-- (según el negocio), y una nota de quien recibe distinta del motivo
-- que reporta el cliente.
-- ============================================================================

-- Nullable y sin valor por defecto: una empresa que no lo configura
-- sigue viendo el mismo comportamiento de antes (ningún tipo
-- preferente), igual que el resto de empresa_config.
alter table empresa_config
  add column tipo_negocio text check (tipo_negocio in ('celular', 'computador', 'patineta', 'otro'));

-- Lo que anota quien recibe el equipo (ej. "trae cargador y forro"),
-- distinto de `motivo` (lo que el cliente reporta con sus palabras).
alter table orden
  add column info_adicional text;
