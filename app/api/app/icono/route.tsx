/**
 * GET /api/app/icono?e=<empresa_id> | ?c=<código> &tam=180|192|512
 *
 * El logo de la empresa centrado en un cuadrado blanco, en PNG, para el
 * ícono de la app instalada. Sin logo, o si la imagen no se puede leer,
 * redirige al ícono genérico.
 */
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { leerEmpresaDeUrl, logoDeEmpresa, tamanoIcono } from "@/lib/icono-app";

const TIPOS_SOPORTADOS = ["image/png", "image/jpeg", "image/gif", "image/svg+xml"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tam = tamanoIcono(params.get("tam"));
  const generico = NextResponse.redirect(new URL("/icon.svg", req.url));

  const logoUrl = await logoDeEmpresa(leerEmpresaDeUrl(params)).catch(() => null);
  if (!logoUrl) return generico;

  let datos: string;
  try {
    const r = await fetch(logoUrl);
    const tipo = r.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!r.ok || !TIPOS_SOPORTADOS.includes(tipo)) return generico;
    datos = `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return generico;
  }

  const lado = Math.round(tam * 0.8);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={datos} width={lado} height={lado} style={{ objectFit: "contain" }} />
      </div>
    ),
    { width: tam, height: tam, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
