-- ============================================================================
-- 0060_ancho_papel_tickets.sql
-- Ancho del rollo de la impresora de tickets de cada sede: 80 mm (48
-- letras por renglón) o 58 mm (32). Los recibos se arman a ese ancho y el
-- logo y el QR se dibujan a la medida (lib/impresion.ts).
-- ============================================================================

alter table impresora_sede
  add column if not exists tickets_ancho_mm smallint not null default 80;

alter table impresora_sede
  drop constraint if exists impresora_sede_tickets_ancho_mm_check;

alter table impresora_sede
  add constraint impresora_sede_tickets_ancho_mm_check
    check (tickets_ancho_mm in (58, 80));
