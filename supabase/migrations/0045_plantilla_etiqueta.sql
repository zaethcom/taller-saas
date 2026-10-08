-- ============================================================================
-- 0045_plantilla_etiqueta.sql
-- Plantillas de etiqueta (sticker) por empresa, editables desde
-- /configuracion: medida del rollo (ancho x alto en mm), resolución de
-- la impresora, tipo de código (QR o código de barras), qué textos
-- llevar y, opcionalmente, una imagen de fondo propia (marco, logo)
-- subida al bucket 'logos'.
--
-- Una plantilla sirve para un solo uso:
--   orden    -> la etiqueta del equipo recibido (etiqueta_qr)
--   articulo -> la de una unidad de mercancía  (etiqueta_articulo)
--   repuesto -> la de un repuesto recibido     (etiqueta_repuesto)
-- y por uso hay como mucho una activa. Sin plantilla activa, cada uso
-- sigue imprimiendo la etiqueta de fábrica de siempre.
--
-- Borrado real: lo que ya se imprimió guarda su propio bitmap en
-- trabajo_impresion.carga, nada apunta a una plantilla.
-- ============================================================================

create table plantilla_etiqueta (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresa(id) on delete cascade,
  uso             text not null check (uso in ('orden','articulo','repuesto')),
  nombre          text not null,
  ancho_mm        numeric(5,1) not null check (ancho_mm between 15 and 104),
  alto_mm         numeric(5,1) not null check (alto_mm between 10 and 150),
  dpi             int not null default 203 check (dpi in (203, 300)),
  codigo          text not null default 'qr' check (codigo in ('qr','barras')),
  campos          text[] not null default '{}',
  fondo_url       text,
  girar           boolean not null default false,
  activa          boolean not null default false,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, uso, nombre)
);

create unique index plantilla_etiqueta_una_activa
  on plantilla_etiqueta (empresa_id, uso)
  where activa;

select _aplica_rls_empresa('plantilla_etiqueta');
