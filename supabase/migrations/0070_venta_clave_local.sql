-- 0070_venta_clave_local.sql
--
-- Ventas hechas sin internet (plan sin internet, fase 3).
--
-- clave_local: identificador que el equipo le pone a la venta cuando la
-- guarda sin conexión. Al volver internet la venta se envía, y si el
-- envío se corta a la mitad y se repite, esta clave hace que el
-- servidor devuelva la venta ya creada en vez de crear otra (y de
-- descontar inventario dos veces). Única por empresa.
--
-- hecha_en: cuándo se hizo de verdad la venta en el mostrador, si fue
-- sin conexión. creada_en sigue siendo cuándo llegó al servidor.
-- null = venta normal, hecha con internet.

alter table venta add column if not exists clave_local uuid;
alter table venta add column if not exists hecha_en timestamptz;

create unique index if not exists venta_clave_local_unica
  on venta (empresa_id, clave_local)
  where clave_local is not null;
