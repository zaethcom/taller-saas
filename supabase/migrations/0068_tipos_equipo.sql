-- ============================================================================
-- 0068_tipos_equipo.sql
-- Los tipos de equipo de Recibir equipo (Patineta, Celular,
-- Computador...) pasan a ser editables por cada empresa en
-- Configuración → Taller. Se guardan como [{ "valor", "etiqueta" }]:
-- el valor es lo que queda en producto.tipo (texto libre desde 0001) y
-- no cambia al renombrar, así que las órdenes viejas y la lógica que
-- mira el valor ("celular" pide teléfono alterno) siguen igual.
--
-- null = la empresa no ha tocado la lista y se usan los de siempre
-- (lib/tipos-equipo.ts). empresa_config ya tiene RLS por empresa.
-- ============================================================================

alter table empresa_config
  add column if not exists tipos_equipo jsonb
    check (tipos_equipo is null or jsonb_typeof(tipos_equipo) = 'array');
