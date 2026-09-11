-- ============================================================================
-- 0016_articulos_inventario.sql
-- Mercancía individualizada: patinetas, teléfonos y demás artículos que
-- la tienda recibe de un proveedor para vender -- no el equipo de un
-- cliente que entra a reparación (eso sigue siendo `producto`, que
-- exige cliente_id) ni un repuesto a granel (`repuesto`/`existencia`,
-- que solo lleva cantidad, no identidad).
--
-- Cada fila es UNA unidad física con su propio código y su propia
-- etiqueta -- el requisito explícito es que la recepción nunca deje
-- pasar una unidad sin imprimir la suya.
-- ============================================================================

create table articulo (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresa(id),
  sede_id        uuid not null references sede(id),   -- dónde está físicamente ahora
  numero         serial,                                -- ART-000123 se arma en la app
  tipo           text not null,   -- 'patineta' | 'celular' | ... (libre, como producto.tipo)
  marca          text,
  modelo         text,
  numero_serie   text,            -- IMEI o serial del fabricante, si lo tiene
  costo          numeric(12,2) not null default 0,
  precio_venta   numeric(12,2) not null default 0,
  estado         text not null default 'en_stock' check (estado in ('en_stock','trasladado','vendido','anulado')),
  creado_por     uuid not null references perfil(id),
  creado_en      timestamptz not null default now()
);

create index on articulo (empresa_id, sede_id, estado);

select _aplica_rls_empresa('articulo');

-- Nuevo tipo de trabajo de impresión: la etiqueta de UN artículo de
-- inventario -- distinta de etiqueta_qr, que siempre lleva un numeroOrden
-- porque nace de una orden de reparación. Un artículo no tiene orden.
alter table trabajo_impresion drop constraint trabajo_impresion_tipo_check;
alter table trabajo_impresion add constraint trabajo_impresion_tipo_check check (tipo in
  ('etiqueta_qr','recibo_venta','comprobante_recepcion',
   'cierre_caja','abrir_cajon','comprobante_traslado','etiqueta_articulo'));
