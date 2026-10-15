-- ============================================================================
-- 0059_etiquetas_en_pos.sql
-- Sedes sin etiquetadora: "escpos" imprime las etiquetas como imagen en la
-- impresora POS de tickets (estacion/etiqueta-escpos.ts). Antes solo había
-- "pplb" (Argox) y "zpl" (Zebra), y la POS imprimía esos comandos como texto.
-- ============================================================================

alter table impresora_sede
  drop constraint if exists impresora_sede_etiquetas_lenguaje_check;

alter table impresora_sede
  add constraint impresora_sede_etiquetas_lenguaje_check
    check (etiquetas_lenguaje in ('pplb','zpl','escpos'));
