-- ============================================================================
-- 0054_orden_telefono_alterno.sql
-- Número alternativo de contacto de la orden. En un taller de celulares
-- el cliente deja el equipo -- su propio teléfono -- y por ese número ya
-- no se le puede escribir. Recibir equipo pide entonces otro número
-- (un familiar, el trabajo) y el botón "Enviar por WhatsApp" de la
-- orden escribe ahí; si no hay, al teléfono del cliente.
--
-- Vive en la orden y no en el cliente: es el contacto de esta visita,
-- no un dato permanente de la persona. Como el teléfono del cliente, no
-- entra a la vista orden_para_tecnico (0003); el enlace de WhatsApp lo
-- arma el servidor.
-- ============================================================================

alter table orden add column telefono_alterno text;
