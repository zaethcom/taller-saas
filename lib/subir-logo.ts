/**
 * Sube el logo de la empresa al bucket público 'logos', con la
 * convención de ruta que exigen las políticas de 0021_empresa_config.sql
 * (logos/<empresa_id>/logo.<ext>) -- sobrescribe el logo anterior en vez
 * de acumular archivos, porque una empresa tiene un solo logo vigente.
 *
 * Solo para el navegador: usa clienteNavegador(), que respeta RLS con
 * la sesión del usuario -- si la ruta no empieza con su empresa_id,
 * Storage rechaza la subida antes de que este código pueda hacer nada.
 */
import { clienteNavegador } from "./supabase/cliente";

export async function subirLogo(empresaId: string, archivo: File): Promise<string> {
  const supabase = clienteNavegador();
  const extension = archivo.name.split(".").pop() ?? "png";
  const ruta = `${empresaId}/logo.${extension}`;

  const { error } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true });
  if (error) {
    throw new Error(`No se pudo subir el logo: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(ruta);

  // Cache-busting: si se reemplaza el logo con el mismo nombre de
  // archivo, el navegador (y el CDN de Storage) podrían seguir
  // mostrando el viejo si no cambia la URL.
  return `${publicUrl}?v=${Date.now()}`;
}
