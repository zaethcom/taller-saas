-- ============================================================================
-- 0002_rls.sql
-- El aislamiento entre empresas. Esta es la pieza que hace que el sistema
-- sea multiempresa de verdad: se escribe una vez y protege para siempre.
--
-- A partir de aquí, `select * from orden` devuelve únicamente las filas
-- de la empresa del usuario -- no porque el código haya recordado filtrar,
-- sino porque la base de datos no entrega nada más, aunque el código lo pida.
-- ============================================================================

create or replace function empresa_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfil where id = auth.uid() and activo
$$;

-- Plantilla que se repite para cada tabla del negocio. No dejar ninguna
-- tabla con datos de empresa por fuera de esto.
create or replace function _aplica_rls_empresa(nombre_tabla text) returns void
language plpgsql as $$
begin
  execute format('alter table %I enable row level security', nombre_tabla);
  execute format(
    'create policy %I on %I for all to authenticated
       using (empresa_id = empresa_actual())
       with check (empresa_id = empresa_actual())',
    nombre_tabla || '_de_mi_empresa', nombre_tabla
  );
end;
$$;

select _aplica_rls_empresa('empresa');
select _aplica_rls_empresa('sede');
select _aplica_rls_empresa('perfil');
select _aplica_rls_empresa('cliente');
select _aplica_rls_empresa('producto');
select _aplica_rls_empresa('orden');
select _aplica_rls_empresa('orden_evento');
select _aplica_rls_empresa('evidencia');
select _aplica_rls_empresa('cotizacion');
select _aplica_rls_empresa('repuesto_solicitud');

-- empresa necesita su propia policy de lectura para el propio registro,
-- porque empresa.id no es empresa_id -- el helper genérico no aplica igual.
drop policy if exists empresa_de_mi_empresa on empresa;
create policy empresa_de_mi_empresa on empresa
  for all to authenticated
  using (id = empresa_actual())
  with check (id = empresa_actual());

-- cotizacion_item no lleva empresa_id directo: hereda el aislamiento
-- de su cotización.
alter table cotizacion_item enable row level security;
create policy cotizacion_item_de_mi_empresa on cotizacion_item
  for all to authenticated
  using (
    exists (
      select 1 from cotizacion c
      where c.id = cotizacion_item.cotizacion_id
        and c.empresa_id = empresa_actual()
    )
  )
  with check (
    exists (
      select 1 from cotizacion c
      where c.id = cotizacion_item.cotizacion_id
        and c.empresa_id = empresa_actual()
    )
  );
