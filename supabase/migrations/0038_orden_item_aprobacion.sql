-- ============================================================================
-- 0038_orden_item_aprobacion.sql
-- Fase F2 del Plan 3: si se agrega un repuesto/servicio/mano de obra
-- DESPUÉS de que el cliente ya aprobó la cotización original, ese ítem
-- queda marcado para que el cliente lo apruebe también -- siempre,
-- sin umbral de monto (decisión confirmada con el cliente).
--
-- No toca lib/estados.ts ni orden.estado: es una aprobación de costo,
-- no una transición de la máquina de estados -- no existe (ni hace
-- falta inventar) un camino de vuelta a "esperando_aprobacion" desde
-- "en_reparacion".
-- ============================================================================

alter table orden_item
  add column requiere_aprobacion boolean not null default false,
  add column decision text check (decision in ('aprobada', 'rechazada')),
  add column decidido_en timestamptz,
  add column decision_ip inet;
