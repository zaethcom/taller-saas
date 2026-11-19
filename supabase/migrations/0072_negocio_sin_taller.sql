-- 0072_negocio_sin_taller.sql
--
-- Negocios sin taller: una tienda que solo vende productos no recibe
-- equipos, así que no necesita Recibir equipo, Órdenes, Cobrar y
-- entregar, la app del técnico ni los catálogos de servicios y mano de
-- obra. Le queda el POS con inventario.
--
--   - tipo_empresa.incluye_taller: lo que trae cada tipo. Celulares,
--     Computadores y Patinetas sí; el tipo nuevo "Venta de productos" no.
--   - empresa.incluye_taller: lo que de verdad usa la empresa. Se copia
--     del tipo al asignarlo y el superadmin lo puede cambiar a mano en la
--     ficha de la empresa.
--
-- Todas las empresas que ya existen quedan con taller (default true):
-- nada cambia para ellas. Quitar el taller no borra órdenes; solo deja
-- de mostrar esas pantallas (lib/taller-activo.ts).
--
-- Los usuarios no pueden cambiar empresa.incluye_taller: desde 0069 la
-- tabla empresa es de solo lectura para ellos; escribe el superadmin con
-- la llave de servicio.

alter table tipo_empresa add column if not exists incluye_taller boolean not null default true;
alter table empresa add column if not exists incluye_taller boolean not null default true;

insert into tipo_empresa (nombre, tipo_equipo, categorias, incluye_taller)
values ('Venta de productos', 'otro', array['Accesorios'], false)
on conflict (nombre) do update set incluye_taller = false;
