/**
 * GET /api/empresas/por-codigo?codigo=<codigo>
 *
 * Lo que /login usa para personalizarse antes de que exista sesión: es
 * la única pantalla sin cuenta (aparte de /seguimiento/[token]), así que
 * no hay forma de saber de qué empresa se trata más que preguntándole a
 * quien va a entrar. Mismo motivo que /api/seguimiento/[token]/route.ts
 * para usar clienteAdmin() -- no hay sesión que darle a RLS -- y misma
 * disciplina de lista blanca: solo lo que ya es público en el resto de
 * la aplicación (logo, color, eslogan, fondo de login), nunca nit ni
 * ningún otro dato de la empresa.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo")?.trim().toLowerCase();
  if (!codigo) {
    return NextResponse.json({ error: "falta el código" }, { status: 400 });
  }

  const admin = clienteAdmin();

  const { data: empresa, error } = await admin.from("empresa").select("id, nombre").eq("codigo", codigo).maybeSingle();

  if (error || !empresa) {
    return NextResponse.json({ error: "no existe una empresa con ese código" }, { status: 404 });
  }

  const { data: config } = await admin
    .from("empresa_config")
    .select("logo_url, color_principal, eslogan, fondo_login_url")
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  return NextResponse.json({
    nombre: empresa.nombre,
    logoUrl: config?.logo_url ?? null,
    colorPrincipal: config?.color_principal ?? null,
    eslogan: config?.eslogan ?? null,
    fondoLoginUrl: config?.fondo_login_url ?? null,
  });
}
