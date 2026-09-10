-- ============================================================================
-- seed.sql
-- Datos de prueba: dos empresas (para poder probar el aislamiento), dos
-- sedes en la primera, algunos clientes, productos y una orden en cada
-- estado de la máquina de lib/estados.ts.
--
-- Ejecutar con: supabase db reset (lo corre automático) o
--               psql -f supabase/seed.sql
-- ============================================================================

insert into empresa (id, nombre, nit) values
  ('11111111-1111-1111-1111-111111111111', 'Rueda Libre Talleres', '900123456-1'),
  ('22222222-2222-2222-2222-222222222222', 'Otro Taller S.A.S.', '900999999-9');

insert into sede (id, empresa_id, nombre, tipo) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Local 1 · Tienda', 'tienda'),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Local 2 · Taller', 'taller'),
  ('a2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Sede única', 'taller');

insert into cliente (id, empresa_id, nombre, documento, telefono, correo) values
  ('c1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Andrea Gómez', '1010101010', '3001112233', 'andrea@example.com'),
  ('c1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Julián Restrepo', '2020202020', '3002223344', 'julian@example.com'),
  ('c2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Cliente de otra empresa', '3030303030', '3003334455', null);

insert into producto (id, empresa_id, cliente_id, serial, tipo, marca, modelo) values
  ('p1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001', 'RL-000001', 'patineta', 'Xiaomi', 'Pro 2'),
  ('p1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000002', 'RL-000002', 'patineta', 'Segway', 'Ninebot ES2'),
  ('p2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'c2222222-0000-0000-0000-000000000001', 'OT-000001', 'patineta', 'Xiaomi', 'Essential');

-- Una orden por cada estado de TRANSICIONES en lib/estados.ts, para poder
-- probar la interfaz sin tener que avanzarlas todas a mano.
insert into orden (id, empresa_id, sede_id, producto_id, estado, motivo, abierta_en) values
  ('o0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'p1111111-0000-0000-0000-000000000001', 'recibida', 'No enciende', now() - interval '1 day'),
  ('o0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'p1111111-0000-0000-0000-000000000002', 'en_diagnostico', 'Frena mal', now() - interval '2 days'),
  ('o0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'a2222222-0000-0000-0000-000000000001', 'p2222222-0000-0000-0000-000000000001', 'recibida', 'Rayón en la base', now());

insert into orden_evento (empresa_id, orden_id, de_estado, a_estado, nota) values
  ('11111111-1111-1111-1111-111111111111', 'o0000000-0000-0000-0000-000000000001', null, 'recibida', 'Recepción inicial'),
  ('11111111-1111-1111-1111-111111111111', 'o0000000-0000-0000-0000-000000000002', null, 'recibida', 'Recepción inicial'),
  ('11111111-1111-1111-1111-111111111111', 'o0000000-0000-0000-0000-000000000002', 'recibida', 'en_diagnostico', 'Asignado a técnico');

insert into repuesto (id, empresa_id, codigo, descripcion, precio_venta) values
  ('r1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'FRE-001', 'Pastillas de freno', 25000),
  ('r1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'BAT-001', 'Batería 36V', 180000);

insert into existencia (repuesto_id, sede_id, empresa_id, cantidad) values
  ('r1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 8),
  ('r1111111-0000-0000-0000-000000000002', 'a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2);
