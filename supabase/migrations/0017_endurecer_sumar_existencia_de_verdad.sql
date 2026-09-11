-- ============================================================================
-- 0017_endurecer_sumar_existencia_de_verdad.sql
-- 0015 revocó el EXECUTE de sumar_existencia de PUBLIC, pero anon
-- seguía pudiendo invocarla vía /rest/v1/rpc/sumar_existencia -- a
-- diferencia de consumir_repuesto y empresa_actual (0010/0011), donde
-- revocar de PUBLIC sí bastó, aquí anon tenía un grant propio (un
-- privilegio por defecto del esquema para funciones nuevas, no
-- heredado de PUBLIC). Revocar de PUBLIC no lo toca. Misma lección que
-- 0010→0011 ya había dejado, aplicada otra vez: comprobar el resultado
-- con los advisors después de "corregir", no asumir que corrigió.
-- ============================================================================

revoke execute on function sumar_existencia(uuid, uuid, int) from anon;
