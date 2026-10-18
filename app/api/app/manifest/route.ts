/**
 * GET /api/app/manifest?e=<empresa_id> | ?c=<código>
 *
 * El manifest de la PWA (reemplaza a app/manifest.ts). Ver lib/icono-app.ts
 * para por qué la empresa llega en la URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { construirManifest, leerEmpresaDeUrl, logoDeEmpresa } from "@/lib/icono-app";

export async function GET(req: NextRequest) {
  const empresa = leerEmpresaDeUrl(req.nextUrl.searchParams);
  const logo = await logoDeEmpresa(empresa).catch(() => null);

  return NextResponse.json(construirManifest(empresa, Boolean(logo)), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
