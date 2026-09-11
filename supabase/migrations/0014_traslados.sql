-- ============================================================================
-- 0014_traslados.sql
-- Traslados internos de inventario entre sedes -- la tienda (almacén)
-- recibe la mercancía y el taller la vende o la consume, pero entre las
-- dos no hay nada automático: alguien empaca, alguien manda, alguien
-- recibe. Esta tabla es el papel de esa cadena de custodia.
--
-- Descontar en el origen pasa por consumir_repuesto (0004_caja.sql) --
-- la misma función que ya usa una venta de mostrador, porque "sacar
-- inventario de una sede" es un solo hecho, no dos implementaciones.
-- Sumar en el destino es nuevo: a diferencia de una venta, el destino
-- puede no tener fila de existencia todavía (por eso upsert).
-- ============================================================================

create table traslado (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresa(id),
  numero           serial,
  sede_origen_id   uuid not null references sede(id),
  sede_destino_id  uuid not null references sede(id),
  estado           text not null default 'enviado' check (estado in ('enviado','recibido','anulado')),
  nota             text,
  enviado_por      uuid not null references perfil(id),
  enviado_en       timestamptz not null default now(),
  recibido_por     uuid references perfil(id),
  recibido_en      timestamptz,
  check (sede_origen_id <> sede_destino_id)
);

create index on traslado (empresa_id, sede_destino_id, estado);

create table traslado_item (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references traslado(id) on delete cascade,
  repuesto_id   uuid not null references repuesto(id),
  descripcion   text not null,   -- copia al momento de enviar, como venta_item
  cantidad      int not null check (cantidad > 0)
);

-- Sumar existencia en el destino. Security definer + empresa_actual(),
-- igual que consumir_repuesto, para que la fila nueva quede en la
-- empresa correcta sin que el llamador tenga que saberlo.
create or replace function sumar_existencia(
  p_repuesto_id uuid, p_sede_id uuid, p_cantidad int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into existencia (repuesto_id, sede_id, empresa_id, cantidad)
  values (p_repuesto_id, p_sede_id, empresa_actual(), p_cantidad)
  on conflict (repuesto_id, sede_id)
  do update set cantidad = existencia.cantidad + excluded.cantidad;
end;
$$;

select _aplica_rls_empresa('traslado');

alter table traslado_item enable row level security;
create policy traslado_item_de_mi_empresa on traslado_item
  for all to authenticated
  using (exists (select 1 from traslado t where t.id = traslado_item.traslado_id and t.empresa_id = empresa_actual()))
  with check (exists (select 1 from traslado t where t.id = traslado_item.traslado_id and t.empresa_id = empresa_actual()));

-- Nuevo tipo de trabajo de impresión: el comprobante que acompaña la
-- mercancía físicamente de una sede a otra.
alter table trabajo_impresion drop constraint trabajo_impresion_tipo_check;
alter table trabajo_impresion add constraint trabajo_impresion_tipo_check check (tipo in
  ('etiqueta_qr','recibo_venta','comprobante_recepcion',
   'cierre_caja','abrir_cajon','comprobante_traslado'));
