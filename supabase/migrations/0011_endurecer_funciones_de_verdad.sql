-- ============================================================================
-- 0011_endurecer_funciones_de_verdad.sql
-- 0010 revocó EXECUTE de anon/authenticated directamente, pero el
-- permiso seguía activo porque Postgres lo había otorgado a PUBLIC al
-- crear las funciones -- y anon/authenticated heredan de PUBLIC.
-- Revocar de un rol puntual no quita lo que el pseudo-rol PUBLIC ya
-- concedió. Esta es la corrección real: revocar de PUBLIC y volver a
-- otorgar, explícitamente, solo a quien de verdad lo necesita.
-- ============================================================================

revoke execute on function empresa_actual() from public;
grant execute on function empresa_actual() to authenticated;

revoke execute on function consumir_repuesto(uuid, uuid, int) from public;
grant execute on function consumir_repuesto(uuid, uuid, int) to authenticated;

-- Estas dos solo las llama el cliente de servicio (service_role) desde
-- lib/estacion-auth.ts y la ruta de resultado de impresión. Ni anon ni
-- authenticated tienen motivo para invocarlas por /rest/v1/rpc/... --
-- service_role no depende de este grant para funcionar.
revoke execute on function marcar_resultado_impresion(uuid, boolean, text) from public;
revoke execute on function verificar_clave_estacion(text) from public;
grant execute on function marcar_resultado_impresion(uuid, boolean, text) to service_role;
grant execute on function verificar_clave_estacion(text) to service_role;
