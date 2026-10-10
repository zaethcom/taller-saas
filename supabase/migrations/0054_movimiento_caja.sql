-- ============================================================================
-- 0054_movimiento_caja.sql
-- Gestión de dinero del turno: meter o sacar efectivo de la caja sin una
-- venta detrás (pagarle a un proveedor, cambio que trae el dueño, etc.).
-- Cada movimiento lleva su motivo, abre el cajón y cuenta en el efectivo
-- esperado al cerrar el turno (lib/caja.ts).
--
-- apertura_cajon (0004) sigue siendo la bitácora de cada vez que se abre
-- el cajón; esto es el dinero que entró o salió en esa apertura.
-- ============================================================================

create table movimiento_caja (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id),
  sede_id     uuid not null references sede(id),
  turno_id    uuid not null references turno_caja(id),
  tipo        text not null check (tipo in ('ingreso', 'salida')),
  monto       numeric(12,2) not null check (monto > 0),
  motivo      text not null check (length(trim(motivo)) > 0),
  autor_id    uuid not null references perfil(id),
  creado_en   timestamptz not null default now()
);

create index on movimiento_caja (turno_id);

select _aplica_rls_empresa('movimiento_caja');
