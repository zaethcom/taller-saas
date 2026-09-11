-- ============================================================================
-- 0015_endurecer_sumar_existencia.sql
-- sumar_existencia (0014_traslados.sql) se creó SECURITY DEFINER sin
-- revocar el EXECUTE que Postgres concede a PUBLIC por defecto -- el
-- mismo descuido que 0010/0011 ya habían corregido para las funciones
-- anteriores, repetido en una función nueva. Misma corrección: revocar
-- de PUBLIC y otorgar, explícito, solo a authenticated.
--
-- (No alcanzó del todo -- ver 0017_endurecer_sumar_existencia_de_verdad.sql.)
-- ============================================================================

revoke execute on function sumar_existencia(uuid, uuid, int) from public;
grant execute on function sumar_existencia(uuid, uuid, int) to authenticated;
