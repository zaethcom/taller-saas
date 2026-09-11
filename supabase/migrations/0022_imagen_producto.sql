-- ============================================================================
-- 0022_imagen_producto.sql
-- Foto de producto para repuesto y articulo -- lo único que le faltaba a
-- ambos catálogos para mostrarse en tarjetas con imagen en /vender e
-- /inventario, en vez de solo filas de texto. Opcional a propósito: sin
-- foto, la tarjeta cae en un ícono según el tipo, igual que el logo de
-- empresa cae en su inicial cuando no hay uno (0021_empresa_config.sql).
-- ============================================================================

alter table repuesto add column imagen_url text;
alter table articulo add column imagen_url text;

-- Bucket público, mismo motivo que 'logos': la foto se ve en tarjetas de
-- /vender e /inventario dentro de la sesión, pero servirla como pública
-- evita depender de URLs firmadas que expiran -- no hay nada sensible en
-- la foto de un repuesto o de un artículo en venta.
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'productos';

-- Convención de ruta: productos/<empresa_id>/repuesto/<id>.<ext> o
-- productos/<empresa_id>/articulo/<id>.<ext> -- el primer segmento sigue
-- siendo la empresa (igual que 'logos'), así que la misma comprobación
-- de carpeta basta para aislar la escritura por empresa.
create policy productos_lectura_publica on storage.objects
  for select to public
  using (bucket_id = 'productos');

create policy productos_escritura_de_mi_empresa on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and (storage.foldername(name))[1] = empresa_actual()::text);

create policy productos_actualizacion_de_mi_empresa on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and (storage.foldername(name))[1] = empresa_actual()::text)
  with check (bucket_id = 'productos' and (storage.foldername(name))[1] = empresa_actual()::text);
