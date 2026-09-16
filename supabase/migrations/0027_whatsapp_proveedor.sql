-- ============================================================================
-- 0027_whatsapp_proveedor.sql
-- Número al que /compras manda la lista de faltantes por WhatsApp. Es un
-- enlace wa.me simple (sin backend, sin cuenta de negocio de Meta) --
-- mismo espíritu que recibo_telefono en 0021: un dato de configuración
-- de la empresa, no una integración.
-- ============================================================================

alter table empresa_config
  add column whatsapp_proveedor text;
