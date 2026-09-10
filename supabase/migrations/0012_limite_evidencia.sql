-- ============================================================================
-- 0012_limite_evidencia.sql
-- El plano de construcción original dejaba el video fuera de la v1 por
-- peso y por red del taller. Se activa a pedido, pero con un límite:
-- 50 MB por archivo (unos 30-40 segundos de video de celular a calidad
-- media) y solo imagen o video -- nada de subir cualquier tipo de
-- archivo al bucket de evidencia.
--
-- Sin este límite, un técnico grabando un minuto entero de "aquí está
-- el problema" agota la cuota de Storage del plan gratuito en pocas
-- órdenes.
-- ============================================================================

update storage.buckets
set file_size_limit = 52428800,  -- 50 MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']
where id = 'evidencia';
