-- ============================================================================
-- 0029_marca_login.sql
-- La pantalla de /login es la única sin sesión, así que hoy no puede
-- saber de qué empresa se trata (ver comentario en app/(auth)/login/page.tsx)
-- y por eso siempre se ve genérica -- "Taller SaaS" sobre negro plano,
-- sin logo ni color de marca, aunque la empresa ya los tenga configurados
-- para el resto de la aplicación.
--
-- `empresa.codigo` es el dato que rompe ese bloqueo: un código corto que
-- quien va a iniciar sesión escribe primero, y que el login usa para
-- resolver -- sin sesión, vía una consulta pública de solo lectura -- el
-- logo, el color, el eslogan y ahora también el fondo de esa empresa
-- puntual, antes de pedir correo y contraseña.
-- ============================================================================

alter table empresa add column codigo text unique;

alter table empresa_config add column fondo_login_url text;
