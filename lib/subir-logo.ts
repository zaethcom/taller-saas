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
import { reducirImagen } from "./reducir-imagen";

async function subirImagenDeMarca(empresaId: string, archivo: File, nombre: "logo" | "marca" | "fondo-login"): Promise<string> {
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

/**
 * El fondo del login se achica antes de subir (lib/reducir-imagen.ts) y
 * después se comprueba que quedó completo: una subida cortada a medias
 * se guardaba igual y el login mostraba solo la franja de arriba de la
 * imagen sobre negro.
 */
export async function subirFondoLogin(empresaId: string, archivo: File): Promise<string> {
  const reducido = await reducirImagen(archivo);
  const url = await subirImagenDeMarca(empresaId, reducido, "fondo-login");

  let guardado: number | null = null;
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    const largo = Number(r.headers.get("content-length"));
    if (r.ok && largo > 0) guardado = largo;
  } catch {
    // Sin poder comprobarlo no se bloquea: se queda con lo subido.
  }
  if (guardado !== null && guardado !== reducido.size) {
    throw new Error("La imagen se subió incompleta. Vuelve a elegirla para intentarlo de nuevo.");
  }
  return url;
}

/**
 * El logo propio de una sede (si difiere del de la empresa) --
 * subcarpeta bajo el mismo primer segmento de ruta que ya exigen las
 * políticas del bucket, así que no necesitan ningún cambio.
 */
export async function subirLogoSede(empresaId: string, sedeId: string, archivo: File): Promise<string> {
  const supabase = clienteNavegador();
  const extension = archivo.name.split(".").pop() ?? "png";
  const ruta = `${empresaId}/sedes/${sedeId}/logo.${extension}`;

  const { error } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true });
  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(ruta);

  return `${publicUrl}?v=${Date.now()}`;
}

/**
 * La imagen de fondo propia de una plantilla de etiqueta (0046): un
 * marco o logo diseñado a la medida del sticker, sobre el que se dibujan
 * el código y los textos. Nombre con marca de tiempo, no fijo: cada
 * plantilla puede tener la suya y ninguna pisa la de otra.
 */
export async function subirFondoEtiqueta(empresaId: string, archivo: File): Promise<string> {
  const supabase = clienteNavegador();
  const extension = archivo.name.split(".").pop() ?? "png";
  const ruta = `${empresaId}/etiquetas/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("logos").upload(ruta, archivo);
  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  return supabase.storage.from("logos").getPublicUrl(ruta).data.publicUrl;
}
