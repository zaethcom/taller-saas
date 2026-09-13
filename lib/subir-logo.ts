/**
 * Sube una imagen de marca de la empresa (logo, o la foto del bloque de
 * marca al pie del menú lateral) al bucket público 'logos', con la
 * convención de ruta que exigen las políticas de 0021_empresa_config.sql
 * (logos/<empresa_id>/<nombre>.<ext>) -- sobrescribe la anterior en vez
 * de acumular archivos, porque una empresa tiene una sola vigente por rol.
 *
 * Solo para el navegador: usa clienteNavegador(), que respeta RLS con
 * la sesión del usuario -- si la ruta no empieza con su empresa_id,
 * Storage rechaza la subida antes de que este código pueda hacer nada.
 */
import { clienteNavegador } from "./supabase/cliente";

async function subirImagenDeMarca(empresaId: string, archivo: File, nombre: "logo" | "marca"): Promise<string> {
  const supabase = clienteNavegador();
  const extension = archivo.name.split(".").pop() ?? "png";
  const ruta = `${empresaId}/${nombre}.${extension}`;

  const { error } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true });
  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(ruta);

  // Cache-busting: si se reemplaza la imagen con el mismo nombre de
  // archivo, el navegador (y el CDN de Storage) podrían seguir
  // mostrando la vieja si no cambia la URL.
  return `${publicUrl}?v=${Date.now()}`;
}

export function subirLogo(empresaId: string, archivo: File): Promise<string> {
  return subirImagenDeMarca(empresaId, archivo, "logo");
}

export function subirImagenMarca(empresaId: string, archivo: File): Promise<string> {
  return subirImagenDeMarca(empresaId, archivo, "marca");
}
