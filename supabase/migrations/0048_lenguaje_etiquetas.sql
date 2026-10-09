-- ============================================================================
-- 0048_lenguaje_etiquetas.sql
-- En qué idioma habla la etiquetadora de cada sede: "pplb" (Argox, la que
-- se usó hasta ahora, por defecto) o "zpl" (Zebra). La estación arma las
-- etiquetas en uno u otro según esto; tickets no cambian (ESC/POS).
-- ============================================================================

alter table impresora_sede
  add column etiquetas_lenguaje text not null default 'pplb'
    check (etiquetas_lenguaje in ('pplb','zpl'));
