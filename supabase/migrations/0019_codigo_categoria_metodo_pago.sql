-- ============================================================================
-- 0019_codigo_categoria_metodo_pago.sql
-- Fase "POS y taller" del pedido de expansión a SaaS multiempresa:
-- código corto por cajero/técnico, categorías de producto, y métodos de
-- pago configurables por empresa (Nequi, DaviPlata, Bre-B...) en vez de
-- los tres fijos en un check constraint.
--
-- El código de perfil NO es una autenticación paralela -- eso seguiría
-- rompiendo el único mecanismo de login real (Supabase Auth). Es un
-- identificador corto y humano ("C001") para mostrar en recibos y
-- reportes en vez de un nombre completo o un uuid.
-- ============================================================================

alter table perfil add column codigo text;
create unique index perfil_codigo_unico on perfil (empresa_id, codigo) where codigo is not null;

create table categoria (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  nombre      text not null,
  creado_en   timestamptz not null default now(),
  unique (empresa_id, nombre)
);
select _aplica_rls_empresa('categoria');

alter table repuesto add column categoria_id uuid references categoria(id);
alter table articulo add column categoria_id uuid references categoria(id);

-- Antes, el medio de pago era uno de tres valores fijos en un check
-- constraint -- no había manera de que una empresa agregara Nequi sin
-- una migración. Ahora es un catálogo por empresa.
create table metodo_pago (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  nombre      text not null,
  es_efectivo boolean not null default false,   -- decide si abre el cajón y si cuenta en el cierre de caja
  activo      boolean not null default true,
  orden       int not null default 0,
  unique (empresa_id, nombre)
);
select _aplica_rls_empresa('metodo_pago');

-- Cada empresa existente conserva exactamente lo que ya tenía, ahora
-- como filas editables en vez de un check constraint fijo.
insert into metodo_pago (empresa_id, nombre, es_efectivo, orden)
select id, 'Efectivo', true, 1 from empresa
union all
select id, 'Transferencia', false, 2 from empresa
union all
select id, 'Tarjeta', false, 3 from empresa;

-- pago.medio pasa a ser el nombre del método elegido al momento de
-- pagar -- un snapshot, igual que venta_item.descripcion ya lo es del
-- repuesto/artículo. es_efectivo es el mismo snapshot para el booleano
-- del que depende el cálculo de caja (lib/caja.ts): si el método
-- cambiara de es_efectivo más adelante, un pago ya hecho no debe
-- cambiar de categoría retroactivamente.
alter table pago drop constraint pago_medio_check;
alter table pago add column es_efectivo boolean not null default false;
update pago set es_efectivo = (medio = 'efectivo');
alter table pago add column metodo_pago_id uuid references metodo_pago(id);
