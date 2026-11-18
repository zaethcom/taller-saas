-- 0069_empresa_perfil_solo_lectura.sql
--
-- Cierra un hueco de seguridad: desde 0002/0042 las políticas de
-- empresa, perfil y perfil_sede eran `for all`, así que cualquier
-- usuario con sesión podía, desde el navegador y con la llave pública,
-- cambiar su propio rol (perfil.rol), reactivar o extender su empresa
-- (empresa.activa, empresa.servicio_fin) o darse acceso a otras sedes.
--
-- Desde aquí esas tres tablas son de SOLO LECTURA para los usuarios
-- (siguen viendo solo lo de su empresa). Toda escritura pasa por las
-- rutas /api del servidor, que revisan el permiso (lib/permisos.ts) y
-- escriben con la llave de servicio, filtrando por la empresa de quien
-- llama. El superadmin ya escribía así.

drop policy if exists empresa_de_mi_empresa on empresa;
create policy empresa_de_mi_empresa on empresa
  for select to authenticated
  using (id = empresa_actual());

drop policy if exists perfil_de_mi_empresa on perfil;
create policy perfil_de_mi_empresa on perfil
  for select to authenticated
  using (empresa_id = empresa_actual());

drop policy if exists perfil_sede_de_mi_empresa on perfil_sede;
create policy perfil_sede_de_mi_empresa on perfil_sede
  for select to authenticated
  using (empresa_id = empresa_actual());
