-- ============================================================================
-- 0058_numero_orden_por_empresa.sql
-- El número de orden es un consecutivo propio de cada empresa (cada una
-- empieza en 1), no uno general de todo el sistema. Las órdenes que ya
-- existen se renumeran por empresa en el orden en que se crearon.
--
-- El enlace de seguimiento del cliente usa token_publico, no el número,
-- así que no cambia. Una etiqueta QR ya impresa lleva el número viejo:
-- conviene reimprimirla desde la orden.
-- ============================================================================

-- 1. Renumerar las órdenes existentes por empresa.
with nuevo as (
  select id, row_number() over (partition by empresa_id order by abierta_en, numero) as n
  from orden
)
update orden o set numero = nuevo.n
from nuevo
where nuevo.id = o.id and o.numero is distinct from nuevo.n;

-- 2. El número ya no sale de la secuencia general sino del trigger de abajo.
alter table orden alter column numero drop default;
drop sequence if exists orden_numero_seq;
alter table orden alter column numero set not null;
alter table orden add constraint orden_empresa_numero_unico unique (empresa_id, numero);

-- 3. Cada orden nueva toma el siguiente número de su empresa. El candado
--    por empresa evita que dos recepciones simultáneas saquen el mismo.
create or replace function asignar_numero_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('orden_numero:' || new.empresa_id::text));
  select coalesce(max(numero), 0) + 1 into new.numero
  from orden
  where empresa_id = new.empresa_id;
  return new;
end;
$$;

revoke execute on function asignar_numero_orden() from public;

drop trigger if exists orden_numero_por_empresa on orden;
create trigger orden_numero_por_empresa
  before insert on orden
  for each row execute function asignar_numero_orden();
