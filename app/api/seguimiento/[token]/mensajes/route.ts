/**
 * POST /api/seguimiento/<token>/mensajes
 * Body: { texto: string }
 *
 * El cliente deja un mensaje para el taller desde el enlace público --
 * sin sesión detrás, mismo patrón de autorización que /api/aprobacion
 * (el token es la única prueba de identidad). Por eso un límite de
 * largo y uno simple de mensajes por hora: no hay cuenta que bloquear
 * si alguien abusa.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";

const LARGO_MAXIMO = 1000;
const LIMITE_POR_HORA = 10;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json()) as { texto?: string };
  const texto = body.texto?.trim();

  if (!texto) {
    return NextResponse.json({ error: "falta el mensaje" }, { status: 400 });
  }
  if (texto.length > LARGO_MAXIMO) {
    return NextResponse.json({ error: `el mensaje no puede pasar de ${LARGO_MAXIMO} caracteres` }, { status: 400 });
  }

  const admin = clienteAdmin();

  const { data: orden } = await admin
    .from("orden")
    .select("id, empresa_id")
    .eq("token_publico", token)
    .maybeSingle();

  if (!orden) {
    return NextResponse.json({ error: "enlace no válido o vencido" }, { status: 404 });
  }

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("orden_mensaje")
    .select("id", { count: "exact", head: true })
    .eq("orden_id", orden.id)
    .eq("autor_tipo", "cliente")
    .gte("creado_en", haceUnaHora);

  if ((count ?? 0) >= LIMITE_POR_HORA) {
    return NextResponse.json({ error: "demasiados mensajes seguidos -- intenta de nuevo más tarde" }, { status: 429 });
  }

  const { error } = await admin.from("orden_mensaje").insert({
    empresa_id: orden.empresa_id,
    orden_id: orden.id,
    autor_tipo: "cliente",
    texto,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
