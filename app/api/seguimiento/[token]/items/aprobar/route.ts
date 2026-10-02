/**
 * POST /api/seguimiento/<token>/items/aprobar
 * Body: { itemId: string, decision: "aprobada" | "rechazada" }
 *
 * El cliente aprueba o rechaza un orden_item agregado DESPUÉS de haber
 * aprobado la cotización original (Fase F2 del Plan 3) -- misma prueba
 * de consentimiento que /api/aprobacion (fecha + IP), pero esto NO es
 * una transición de la máquina de estados: es aprobar un costo, no
 * mover la orden de estado. No se toca orden.estado ni se llama a
 * transicionar() -- no existe (ni hace falta) un camino de vuelta a
 * "esperando_aprobacion" desde "en_reparacion".
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; itemId?: string; decision?: string };

  if (body.decision !== "aprobada" && body.decision !== "rechazada") {
    return NextResponse.json({ error: "decisión inválida" }, { status: 400 });
  }
  if (!body.token || !body.itemId) {
    return NextResponse.json({ error: "falta el token o el ítem" }, { status: 400 });
  }

  const admin = clienteAdmin();

  const { data: orden } = await admin.from("orden").select("id").eq("token_publico", body.token).maybeSingle();
  if (!orden) {
    return NextResponse.json({ error: "enlace no válido o vencido" }, { status: 404 });
  }

  const { data: item } = await admin
    .from("orden_item")
    .select("id, requiere_aprobacion, decision")
    .eq("id", body.itemId)
    .eq("orden_id", orden.id)
    .maybeSingle();

  if (!item || !item.requiere_aprobacion) {
    return NextResponse.json({ error: "no hay un ítem esperando aprobación con ese id" }, { status: 409 });
  }
  if (item.decision) {
    return NextResponse.json({ error: "este ítem ya fue decidido" }, { status: 409 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await admin
    .from("orden_item")
    .update({ decision: body.decision, decidido_en: new Date().toISOString(), decision_ip: ip })
    .eq("id", item.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
