-- ============================================================================
-- 0042_perfil_sede.sql
-- A qué sedes puede entrar cada usuario. Hasta aquí un usuario tenía una
-- sola sede fija (perfil.sede_id), y todo lo que hacía -- ventas, turno,
-- órdenes, traslados -- quedaba en esa sede aunque ese día estuviera
-- trabajando en otra.
--
-- Ahora, al iniciar sesión, el usuario elige en qué sede está entrando,
-- solo entre las que tiene permitidas aquí. La sede elegida vive en una
-- cookie del dispositivo (lib/sede-activa.ts), no en la base: dos
-- dispositivos con el mismo usuario en sedes distintas no se pisan.
--
-- perfil.sede_id se queda como la sede principal del usuario -- también
-- cuenta como permitida aunque no tenga fila aquí. Los admin pueden
-- entrar a cualquier sede de su empresa sin filas en esta tabla.
-- ============================================================================

create table perfil_sede (
  perfil_id   uuid not null references perfil(id) on delete cascade,
  sede_id     uuid not null references sede(id) on delete cascade,
  empresa_id  uuid not null references empresa(id) on delete cascade,
  primary key (perfil_id, sede_id)
);

select _aplica_rls_empresa('perfil_sede');

-- Lo que ya existe sigue funcionando igual: cada usuario conserva
-- acceso a su sede actual.
insert into perfil_sede (perfil_id, sede_id, empresa_id)
select id, sede_id, empresa_id from perfil where sede_id is not null
on conflict do nothing;
