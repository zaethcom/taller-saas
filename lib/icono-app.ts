/**
 * El ícono con el que queda instalada la app: el logo de la empresa con
 * la que se estaba trabajando, o el genérico de Taller 360 si no hay
 * logo (o todavía no se sabe de qué empresa es quien instala).
 *
 * Por qué la empresa viaja en la URL (?e=<empresa_id> o ?c=<código>) y
 * no se saca de la sesión dentro del manifest: Chrome pide el manifest
 * y sus íconos SIN cookies, así que ahí nunca hay sesión y siempre caía
 * al genérico. El layout raíz sí tiene la sesión (o la cookie del
 * código que dejó /login) y arma estas URLs ya con la empresa adentro.
 *
 * El logo se sirve recortado a un cuadrado PNG de 192/512 (y 180 para
 * iPhone) porque Android ignora los íconos sin tamaño declarado o que no
 * sean cuadrados, que es lo que suele subir una empresa.
 */
import { clienteAdmin } from "@/lib/supabase/servidor";

export const COOKIE_CODIGO_EMPRESA = "taller_codigo";

export interface EmpresaIcono {
  empresaId?: string | null;
  codigo?: string | null;
}

export function parametrosEmpresa({ empresaId, codigo }: EmpresaIcono): string {
  if (empresaId) return `e=${encodeURIComponent(empresaId)}`;
  if (codigo) return `c=${encodeURIComponent(codigo)}`;
  return "";
}

export function leerEmpresaDeUrl(params: URLSearchParams): EmpresaIcono {
  return {
    empresaId: params.get("e")?.trim() || null,
    codigo: params.get("c")?.trim().toLowerCase() || null,
  };
}

const ICONO_GENERICO = [
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
];

/**
 * Sin "maskable" para el logo: el genérico está diseñado para tolerar
 * que el sistema lo recorte en un círculo, el logo de una empresa no.
 */
export function construirManifest(empresa: EmpresaIcono, tieneLogo: boolean) {
  const p = parametrosEmpresa(empresa);
  const icons =
    tieneLogo && p
      ? [192, 512].map((tam) => ({
          src: `/api/app/icono?${p}&tam=${tam}`,
          sizes: `${tam}x${tam}`,
          type: "image/png",
          purpose: "any",
        }))
      : ICONO_GENERICO;

  return {
    name: "Taller 360",
    short_name: "Taller 360",
    description: "POS y servicio técnico trazable por QR",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f7",
    theme_color: "#0b6c78",
    icons,
  };
}

export const TAMANOS_ICONO = [180, 192, 512] as const;

export function tamanoIcono(texto: string | null): number {
  const n = Number(texto);
  return (TAMANOS_ICONO as readonly number[]).includes(n) ? n : 512;
}

/** Mismo criterio de lista blanca que /api/empresas/por-codigo: el logo ya es público. */
export async function logoDeEmpresa({ empresaId, codigo }: EmpresaIcono): Promise<string | null> {
  if (!empresaId && !codigo) return null;
  const admin = clienteAdmin();

  let id = empresaId ?? null;
  if (!id && codigo) {
    const { data } = await admin.from("empresa").select("id").eq("codigo", codigo).maybeSingle();
    id = data?.id ?? null;
  }
  if (!id) return null;

  const { data: config } = await admin.from("empresa_config").select("logo_url").eq("empresa_id", id).maybeSingle();
  return config?.logo_url ?? null;
}
