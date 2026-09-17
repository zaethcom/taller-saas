/**
 * El manifest de la PWA -- lo que decide el ícono que queda al
 * "Agregar a pantalla de inicio". Antes era public/manifest.json
 * estático (siempre el ícono genérico); ahora es dinámico para que
 * cada empresa vea su propio logo al instalar la app, no un ícono
 * genérico de la plataforma.
 *
 * Sin sesión (todavía no inició sesión, o es /seguimiento sin cuenta)
 * cae al ícono genérico -- no hay logo de qué empresa mostrar.
 *
 * No se usa "maskable": el ícono genérico está diseñado para tolerar
 * que el sistema lo recorte en un círculo, pero el logo que suba una
 * empresa no tiene por qué estarlo -- forzar maskable ahí podría
 * cortar partes del logo real.
 */
import type { MetadataRoute } from "next";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion } from "@/lib/configuracion";

const ICONO_GENERICO: MetadataRoute.Manifest["icons"] = [
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
];

function tipoDeImagen(url: string): string {
  const ext = (url.split("?")[0] ?? url).split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  const logoUrl = perfil ? (await obtenerConfiguracion(supabase, perfil.empresaId)).logoUrl : null;

  return {
    name: "Taller SaaS",
    short_name: "Taller",
    description: "POS y servicio técnico trazable por QR",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f7",
    theme_color: "#0b6c78",
    icons: logoUrl
      ? [{ src: logoUrl, sizes: "any", type: tipoDeImagen(logoUrl), purpose: "any" }]
      : ICONO_GENERICO,
  };
}
