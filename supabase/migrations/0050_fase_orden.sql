-- ============================================================================
-- 0050_fase_orden.sql
-- Fases configurables por empresa DENTRO de cada estado de la orden. Un
-- taller de celulares quiere ver "Microsoldadura" o "Control de calidad"
-- mientras la orden está en reparación; uno de patinetas, "Prueba de
-- ruta". Eso no son estados nuevos: la máquina de estados de
-- lib/estados.ts (siete estados, sus transiciones y requisitos) no
-- cambia. Una fase es solo una etiqueta más fina dentro de un estado,
-- y nunca decide si una transición es válida.
--
-- Mismo espíritu que `categoria`/`metodo_pago`/`servicio`: catálogo
-- simple por empresa, activo/inactivo en vez de borrado real.
-- ============================================================================

create table fase_orden (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  -- Los siete estados de lib/estados.ts, repetidos a propósito: si
  -- alguien agrega un estado allá, esta lista también tiene que cambiar.
  estado      text not null check (estado in (
                'recibida','en_diagnostico','esperando_aprobacion','en_reparacion',
                'esperando_repuesto','rechazada','entregada')),
  nombre      text not null,
  posicion    int not null default 0,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
select _aplica_rls_empresa('fase_orden');

create index on fase_orden (empresa_id, estado, posicion);

-- on delete set null: una fase nunca se borra desde la app (se
-- desactiva), pero si alguien la borra a mano la orden no se rompe.
alter table orden add column fase_id uuid references fase_orden(id) on delete set null;

-- El nombre de la fase en el momento del cambio, no una referencia
-- viva -- mismo criterio que orden_item.descripcion: si la fase se
-- renombra después, el historial sigue diciendo lo que pasó. Un cambio
-- de fase sin cambio de estado queda como de_estado = a_estado; no hay
-- ningún constraint ni trigger sobre orden_evento que lo impida.
alter table orden_evento
  add column de_fase text,
  add column a_fase  text;

-- El hub y CabeceraOrden leen de esta vista. Las columnas nuevas van al
-- final por la misma razón de 0037: CREATE OR REPLACE VIEW no deja
-- insertarlas en medio. security_invoker hace que el left join respete
-- también el RLS de fase_orden.
create or replace view orden_para_tecnico as
select
  o.id, o.empresa_id, o.numero, o.estado, o.motivo, o.abierta_en, o.tecnico_id,
  p.serial, p.tipo, p.marca, p.modelo,
  c.nombre as cliente_nombre,
  o.token_publico,
  o.total,
  o.fase_id,
  f.nombre as fase_nombre
from orden o
  join producto p on p.id = o.producto_id
  join cliente  c on c.id = p.cliente_id
  left join fase_orden f on f.id = o.fase_id;

alter view orden_para_tecnico set (security_invoker = true);
