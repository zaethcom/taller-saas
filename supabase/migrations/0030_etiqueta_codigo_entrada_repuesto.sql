-- ============================================================================
-- 0030_etiqueta_codigo_entrada_repuesto.sql
-- Prefijo corto para el "código de entrada" que se imprime en la
-- etiqueta de trazabilidad de una orden (ej. "PS" -> "PS000123") --
-- antes la etiqueta solo mostraba el serial del producto, sin un
-- código propio de la orden. Configurable porque cada empresa quiere
-- el suyo (iniciales del taller, no algo que el sistema deba inventar).
--
-- También habilita el nuevo tipo de trabajo de impresión para la
-- etiqueta de código de barras de repuestos (una por unidad recibida).
-- ============================================================================

alter table empresa_config add column prefijo_etiqueta text not null default 'OR';

alter table trabajo_impresion drop constraint trabajo_impresion_tipo_check;
alter table trabajo_impresion add constraint trabajo_impresion_tipo_check check (tipo in
  ('etiqueta_qr','recibo_venta','comprobante_recepcion','cierre_caja','abrir_cajon',
   'comprobante_traslado','etiqueta_articulo','etiqueta_repuesto'));
