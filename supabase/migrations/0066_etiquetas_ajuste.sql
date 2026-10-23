-- ============================================================================
-- 0066_etiquetas_ajuste.sql
-- Corrimiento horizontal de las etiquetas, por sede, en milímetros.
--
-- Caso real: en la Zebra ZP 500 de Polaco Scooter la etiqueta de la orden
-- salía cortada por la izquierda (el QR sin una esquina, «CÓDIGO» como
-- «DIGO»). Achicar el diseño no lo arreglaba porque el problema es dónde
-- queda el rollo bajo el cabezal, no el tamaño. Con este ajuste se corre
-- toda la imagen de la etiqueta a la derecha (positivo) o a la izquierda
-- (negativo) desde Configurar impresoras, y se comprueba con «Probar».
-- ============================================================================

alter table impresora_sede
  add column if not exists etiquetas_ajuste_mm numeric(4,1) not null default 0;

alter table impresora_sede
  drop constraint if exists impresora_sede_etiquetas_ajuste_mm_check;

alter table impresora_sede
  add constraint impresora_sede_etiquetas_ajuste_mm_check
    check (etiquetas_ajuste_mm between -15 and 15);
