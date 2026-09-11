/**
 * Sube la foto de un repuesto o un artículo al bucket público 'productos',
 * con la convención de ruta que exigen las políticas de
 * 0022_imagen_producto.sql (productos/<empresa_id>/<tipo>/<id>.<ext>) --
 * mismo patrón que lib/subir-logo.ts: sobrescribe en vez de acumular,
 * porque cada producto tiene una sola foto vigente.
 *
 * Solo para el navegador: usa clienteNavegador(), que respeta RLS con la
 * sesión del usuario -- si la ruta no empieza con su empresa_id, Storage
 * rechaza la subida antes de que este código pueda hacer nada.
 */
import { clienteNavegador } from "./supabase/cliente";

export async function subirImagenProducto(
  empresaId: string,
  tipo: "repuesto" | "articulo",
  id: string,
  archivo: File,
): Promise<string> {
  const supabase = clienteNavegador();
  const extension = archivo.name.split(".").pop() ?? "jpg";
  const ruta = `${empresaId}/${tipo}/${id}.${extension}`;

  const { error } = await supabase.storage.from("productos").upload(ruta, archivo, { upsert: true });
  if (error) {
    throw new Error(`No se pudo subir la foto: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("productos").getPublicUrl(ruta);

  // Cache-busting, igual que el logo: si se reemplaza la foto con el
  // mismo nombre de archivo, la URL debe cambiar para que no se quede
  // mostrando la vieja.
  return `${publicUrl}?v=${Date.now()}`;
}
