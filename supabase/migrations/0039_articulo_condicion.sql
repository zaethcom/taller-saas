-- ============================================================================
-- 0039_articulo_condicion.sql
-- Fase E del Plan 3: clasificar el origen/condición de cada artículo
-- recibido (punto 9 del documento del cliente) -- ej. "repuesto
-- original de patineta nuevo" vs. "pantalla desmontada/recuperada".
-- ============================================================================

alter table articulo
  add column condicion text check (
    condicion in ('nuevo_original', 'nuevo_generico', 'usado_segunda', 'desmontado_recuperado')
  );
