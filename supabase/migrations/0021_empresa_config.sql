-- ============================================================================
-- 0021_empresa_config.sql
-- Personalización visual por empresa: logo, color de marca, tema, y los
-- datos que aparecen en el encabezado y pie de cada recibo impreso.
--
-- No se pre-llena una fila por empresa -- GET /api/configuracion
-- devuelve valores por defecto cuando no existe todavía, y PATCH hace
-- upsert. La primera vez que un admin guarda algo es cuando nace la fila.
-- ============================================================================

create table empresa_config (
  empresa_id       uuid primary key references empresa(id) on delete cascade,
  logo_url         text,
  color_principal  text not null default '#0b6c78',
  tema             text not null default 'claro' check (tema in ('claro','oscuro','alto_contraste')),
  recibo_direccion text,
  recibo_telefono  text,
  recibo_pie       text not null default 'Gracias por su preferencia',
  actualizado_en   timestamptz not null default now()
);

select _aplica_rls_empresa('empresa_config');

-- El logo es lo único que debe verse SIN sesión -- se muestra en /login
-- antes de que exista un usuario autenticado, y en el recibo público de
-- /seguimiento/[token]. Por eso su bucket es público de lectura, a
-- diferencia de 'evidencia' -- nunca es información sensible del negocio.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 2097152,  -- 2 MB -- un logo no necesita más, y así no se come la cuota gratuita
    allowed_mime_types = array['image/png','image/jpeg','image/svg+xml','image/webp']
where id = 'logos';

-- Convención de ruta: logos/<empresa_id>/logo.<ext> -- igual que
-- evidencia, el primer segmento decide quién puede escribir.
create policy logos_lectura_publica on storage.objects
  for select to public
  using (bucket_id = 'logos');

create policy logos_escritura_de_mi_empresa on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = empresa_actual()::text
  );

create policy logos_actualizacion_de_mi_empresa on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = empresa_actual()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = empresa_actual()::text);
