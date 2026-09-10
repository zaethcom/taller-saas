/**
 * POST /api/aprobacion
 * Body: { token: string, decision: "aprobada" | "rechazada" }
 *
 * El cliente aprueba o rechaza la cotización desde el enlace público.
 * La decisión queda grabada con fecha e IP -- es la prueba de
 * consentimiento que exige el modelo de datos (cotizacion.decision_ip).
 *
 * Mueve la orden de estado usando la MISMA máquina de estados que el
 * resto del sistema -- transicionar() de lib/estados.ts -- para que
 * esta ruta no pueda saltarse una regla que el resto de la app respeta.
 */
import { NextRequest, NextResponse } from "next/server";
import { RequisitoFaltanteError, TransicionInvalidaError, transicionar } from "@/lib/estados";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; decision?: string };

  if (body.decision !== "aprobada" && body.decision !== "rechazada") {
    return NextResponse.json({ error: "decisión inválida" }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "falta el token" }, { status: 400 });
  }

  const admin = clienteAdmin();

  const { data: orden, error: errOrden } = await admin
    .from("orden")
    .select("id, empresa_id, estado")
    .eq("token_publico", body.token)
    .maybeSingle();

  if (errOrden || !orden) {
    return NextResponse.json({ error: "enlace no válido o vencido" }, { status: 404 });
  }

  const { data: cotizacion, error: errCot } = await admin
    .from("cotizacion")
    .select("id, decision")
    .eq("orden_id", orden.id)
    .eq("estado", "enviada")
    .order("enviada_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errCot || !cotizacion) {
    return NextResponse.json({ error: "no hay una cotización esperando aprobación" }, { status: 409 });
  }
  if (cotizacion.decision) {
    return NextResponse.json({ error: "esta cotización ya fue decidida" }, { status: 409 });
  }

  const aEstado = body.decision === "aprobada" ? "en_reparacion" : "rechazada";

  try {
    transicionar(
      orden.estado,
      aEstado,
      new Set(body.decision === "aprobada" ? ["cotizacion_aprobada"] : []),
    );
  } catch (e) {
    if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error: errUpdateCot } = await admin
    .from("cotizacion")
    .update({ decision: body.decision, decidida_en: new Date().toISOString(), decision_ip: ip })
    .eq("id", cotizacion.id);

  if (errUpdateCot) {
    return NextResponse.json({ error: errUpdateCot.message }, { status: 500 });
  }

  await admin.from("orden").update({ estado: aEstado }).eq("id", orden.id);
  await admin.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: orden.id,
    de_estado: orden.estado,
    a_estado: aEstado,
    nota: `Cliente ${body.decision === "aprobada" ? "aprobó" : "rechazó"} la cotización desde el enlace`,
  });

  return NextResponse.json({ ok: true, estado: aEstado });
}
