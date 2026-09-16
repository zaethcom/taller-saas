/**
 * Leer la personalización de una empresa (logo, color, tema, datos de
 * recibo), con valores por defecto cuando todavía no existe la fila --
 * el layout raíz necesita esto en cada request, exista o no
 * personalización guardada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Tema = "claro" | "oscuro" | "alto_contraste";

export interface ConfiguracionEmpresa {
  logoUrl: string | null;
  colorPrincipal: string;
  tema: Tema;
  reciboDireccion: string | null;
  reciboTelefono: string | null;
  reciboPie: string;
  imagenMarcaUrl: string | null;
  eslogan: string | null;
  whatsappProveedor: string | null;
  fondoLoginUrl: string | null;
}

export const CONFIG_POR_DEFECTO: ConfiguracionEmpresa = {
  logoUrl: null,
  colorPrincipal: "#0b6c78",
  tema: "claro",
  reciboDireccion: null,
  reciboTelefono: null,
  reciboPie: "Gracias por su preferencia",
  imagenMarcaUrl: null,
  eslogan: null,
  whatsappProveedor: null,
  fondoLoginUrl: null,
};

export async function obtenerConfiguracion(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<ConfiguracionEmpresa> {
  const { data } = await supabase
    .from("empresa_config")
    .select(
      "logo_url, color_principal, tema, recibo_direccion, recibo_telefono, recibo_pie, imagen_marca_url, eslogan, whatsapp_proveedor, fondo_login_url",
    )
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!data) return CONFIG_POR_DEFECTO;

  return {
    logoUrl: data.logo_url,
    colorPrincipal: data.color_principal,
    tema: data.tema as Tema,
    reciboDireccion: data.recibo_direccion,
    reciboTelefono: data.recibo_telefono,
    reciboPie: data.recibo_pie,
    imagenMarcaUrl: data.imagen_marca_url,
    eslogan: data.eslogan,
    whatsappProveedor: data.whatsapp_proveedor,
    fondoLoginUrl: data.fondo_login_url,
  };
}
