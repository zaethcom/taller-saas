-- ============================================================================
-- 0024_marca_menu_lateral.sql
-- El bloque de marca al pie del menú lateral (foto + eslogan) es parte de
-- la personalización por empresa, igual que el logo -- no un diseño fijo
-- de una sola empresa. Sin esto, cualquier "look" de referencia (ej.
-- Team Polaco Scooter) quedaría cableado en el componente en vez de
-- vivir en empresa_config, y la siguiente empresa (Celutec) no podría
-- poner el suyo sin tocar código.
-- ============================================================================

alter table empresa_config
  add column imagen_marca_url text,
  add column eslogan text;

-- Misma convención que el logo: logos/<empresa_id>/marca.<ext>, en el
-- mismo bucket público -- ya tiene las políticas de lectura pública y
-- escritura restringida a la propia empresa (0021_empresa_config.sql),
-- y no es información sensible del negocio.
