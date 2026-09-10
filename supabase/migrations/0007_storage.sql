-- ============================================================================
-- 0007_storage.sql
-- El bucket privado de evidencia (fotos y videos de las órdenes) y las
-- políticas que lo mantienen aislado por empresa.
--
-- Convención de rutas, obligatoria para que estas políticas funcionen:
--   evidencia/<empresa_id>/<orden_id>/<archivo>
-- El primer segmento de la ruta ES el empresa_id -- las políticas lo
-- comparan contra empresa_actual() sin tener que hacer join a ninguna
-- tabla.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('evidencia', 'evidencia', false)
on conflict (id) do nothing;

create policy evidencia_lectura_de_mi_empresa on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = empresa_actual()::text
  );

create policy evidencia_escritura_de_mi_empresa on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencia'
    and (storage.foldername(name))[1] = empresa_actual()::text
  );

-- Nadie borra evidencia desde la aplicación -- es un registro legal de
-- lo que se recibió y se entregó. Si algún día hace falta un borrado
-- (una política de retención), se hace con service role, a propósito,
-- nunca desde una policy que un usuario normal pueda disparar.
