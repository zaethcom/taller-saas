-- ============================================================================
-- 0053_tipo_empresa.sql
-- Tipos de empresa (celulares, computadores, patinetas...) como
-- estándares que el superadmin define una vez y le asigna a cada
-- empresa. Un tipo trae lo que cambia según el negocio:
--   - tipo_equipo: qué tipo de equipo propone Recibir equipo por
--     defecto (se copia a empresa_config.tipo_negocio, 0035);
--   - fases: las fases de la orden por estado (0050), mismo formato
--     que las plantillas de lib/fases.ts: { "en_reparacion": ["Motor", ...] };
--   - categorias: las categorías iniciales de inventario (0019).
--
-- Asignar un tipo COPIA esas cosas a la empresa y nada más: lo copiado
-- queda como filas normales de la empresa, que su admin edita como
-- quiera. Cambiar el estándar después no toca a las empresas que ya
-- lo recibieron, y aplicarlo dos veces no duplica nada.
-- ============================================================================

create table tipo_empresa (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique,
  tipo_equipo  text not null default 'otro'
                 check (tipo_equipo in ('celular', 'computador', 'patineta', 'otro')),
  fases        jsonb not null default '{}'::jsonb,
  categorias   text[] not null default '{}',
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- Catálogo de la plataforma, no de una empresa: solo el superadmin lo
-- usa, siempre con service_role (se salta RLS). RLS encendida y sin
-- policies, igual que pago_servicio (0052).
alter table tipo_empresa enable row level security;

-- on delete set null: borrar un tipo nunca deja a una empresa rota; lo
-- que ya se le copió sigue siendo suyo.
alter table empresa add column tipo_empresa_id uuid references tipo_empresa(id) on delete set null;

insert into tipo_empresa (nombre, tipo_equipo, fases, categorias) values
  ('Celulares', 'celular',
   '{"en_diagnostico": ["Desarme", "Pruebas de hardware"],
     "en_reparacion": ["Cambio de pantalla o batería", "Microsoldadura", "Software", "Control de calidad", "Terminado"]}',
   array['Pantallas', 'Baterías', 'Pines de carga', 'Flex', 'Cámaras', 'Accesorios']),
  ('Computadores', 'computador',
   '{"en_diagnostico": ["Revisión de hardware", "Pruebas de software"],
     "en_reparacion": ["Limpieza y mantenimiento", "Cambio de piezas", "Formateo e instalación", "Control de calidad", "Terminado"]}',
   array['Discos', 'Memorias RAM', 'Pantallas', 'Teclados', 'Cargadores', 'Baterías', 'Accesorios']),
  ('Patinetas', 'patineta',
   '{"en_diagnostico": ["Revisión eléctrica", "Revisión mecánica"],
     "en_reparacion": ["Llantas y frenos", "Batería y controlador", "Motor", "Prueba de ruta", "Terminado"]}',
   array['Llantas', 'Frenos', 'Baterías', 'Controladores', 'Motores', 'Accesorios']);
