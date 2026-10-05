-- ============================================================================
-- 0036_vincular_estacion.sql
-- Vincular una estación de impresión desde la web, en vez de un INSERT a mano.
--
-- estacion_credencial (0006) ya modela bien la identidad de una estación:
-- (empresa_id, sede_id) y la clave hasheada, sin sesión de usuario. Lo que
-- falta es poder CREARLA sin entrar a la base: hoy no hay ninguna ruta que
-- la inserte, así que dar de alta una sede nueva exige un INSERT manual, y
-- eso no escala en un SaaS con varios negocios.
--
-- Esta migración no cambia cómo se autentica nada. Solo quita lo que impide
-- rotar una clave, y agrega con qué distinguir una credencial de otra.
-- ============================================================================

-- 1. `sede_id ... unique` permitía UNA sola fila por sede, para siempre.
--    Con eso, rotar una clave obliga a pisar la fila existente -- y se
--    pierde el rastro de la anterior, que es justo lo que se quiere mirar
--    cuando algo dejó de imprimir. Lo que de verdad hay que impedir es que
--    una sede tenga DOS credenciales activas a la vez; una revocada puede
--    (y debe) quedarse.
alter table estacion_credencial
  drop constraint if exists estacion_credencial_sede_id_key;

create unique index if not exists estacion_credencial_una_activa_por_sede
  on estacion_credencial (sede_id)
  where revocada_en is null;

-- 2. Con varias filas por sede hace falta poder distinguirlas en la
--    pantalla: cuál es la tablet del mostrador y cuál la que se cambió.
alter table estacion_credencial
  add column if not exists nombre text,
  -- Quién la generó. Una credencial es un secreto que da acceso a la cola
  -- de impresión de una sede: si aparece una que nadie reconoce, hay que
  -- poder saber de dónde salió.
  add column if not exists creada_por uuid references perfil(id);

comment on column estacion_credencial.nombre is
  'Cómo la llama quien la creó ("Tablet mostrador"). Solo para la pantalla.';

-- 3. La revocación ya la respeta verificar_clave_estacion (0006), que
--    filtra revocada_en is null. No hace falta tocar esa función.
