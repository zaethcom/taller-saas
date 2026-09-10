-- ============================================================================
-- 0010_endurecer_funciones.sql
-- El linter de seguridad de Supabase encontró dos huecos reales después
-- de aplicar el esquema:
--
--   1. _aplica_rls_empresa() no tenía search_path fijo -- un search_path
--      mutable en una función es la puerta clásica para que alguien con
--      permiso de crear objetos en algún schema del path intercepte una
--      llamada sin calificar (ej. "format") con su propia versión.
--
--   2. Varias funciones SECURITY DEFINER quedaban expuestas por
--      PostgREST a roles que nunca deberían poder llamarlas
--      directamente por /rest/v1/rpc/<funcion> -- porque toda función
--      en el schema public es invocable por API a menos que se
--      revoque el permiso explícitamente.
-- ============================================================================

alter function _aplica_rls_empresa(text) set search_path = public;

-- empresa_actual() la evalúa cada policy RLS para el rol authenticated
-- -- ese rol necesita poder ejecutarla. anon no tiene ninguna policy
-- que dependa de ella (todas dicen "for all to authenticated"), así
-- que no necesita invocarla directamente.
revoke execute on function empresa_actual() from anon;

-- Las rutas de servidor llaman a esto con la sesión del usuario
-- (authenticated) -- anon nunca debería poder descontar inventario.
revoke execute on function consumir_repuesto(uuid, uuid, int) from anon;

-- Estas dos solo las llama el cliente de servicio (service_role) desde
-- lib/estacion-auth.ts y la ruta de resultado de impresión -- ningún
-- usuario final, autenticado o no, tiene motivo para invocarlas.
revoke execute on function marcar_resultado_impresion(uuid, boolean, text) from anon, authenticated;
revoke execute on function verificar_clave_estacion(text) from anon, authenticated;
