/**
 * POST /api/aprobacion
 * Body: { token: string, decision: "aprobada" | "rechazada", motivo?: string }
 *
 * Aprobada vuelve a "En proceso", o a "Falta repuesto" si la orden
 * tiene repuestos pedidos que no han llegado (estadoSegunRepuestos).
 * Rechazada sigue "Esperando al cliente" con la marca de que no aprobó
 * y el motivo en el historial: se le recotiza o se entrega sin reparar.
 *
 * La ficha del técnico usa esta misma ruta cuando el cliente responde
 * en persona o por teléfono.
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
import { RequisitoFaltanteError, TransicionInvalidaError, estadoSegunRepuestos, transicionar } from "@/lib/estados";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { reservarAlAprobar } from "@/lib/reservas-servidor";
import { crearAviso } from "@/lib/avisos-servidor";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; decision?: string; motivo?: string };
  const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) : "";

  if (body.decision !== "aprobada" && body.decision !== "rechazada") {
    return NextResponse.json({ error: "decisión inválida" }, { status: 400 });
  }
  if (!body.token) {
    return NextResponse.json({ error: "falta el token" }, { status: 400 });
  }

  const admin = clienteAdmin();

  const { data: orden, error: errOrden } = await admin
    .from("orden")
    .select("id, empresa_id, sede_id, estado")
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

  // Aprobada: los repuestos cotizados que hay en la sede quedan
  // apartados para esta orden, y lo que no alcanza se pide a Compras
  // (lib/reservas-servidor.ts). Solo desde esperando_cliente: si la
  // transición no es válida, abajo se rechaza sin haber tocado nada.
  let reservados: string[] = [];
  if (body.decision === "aprobada" && orden.estado === "esperando_cliente") {
    const r = await reservarAlAprobar(admin, {
      ordenId: orden.id,
      empresaId: orden.empresa_id,
      sedeId: orden.sede_id,
      cotizacionId: cotizacion.id,
    });
    reservados = r.reservados.map((x) => x.descripcion);
  }

  // Repuestos pedidos para esta orden que todavía no llegan (desde la
  // recepción, el técnico o la reserva de arriba): sin ellos no se repara.
  const { count: pendientes } = await admin
    .from("repuesto_solicitud")
    .select("id", { count: "exact", head: true })
    .eq("orden_id", orden.id)
    .in("estado", ["faltante", "solicitado"]);

  const aEstado = body.decision === "aprobada" ? estadoSegunRepuestos(pendientes ?? 0) : "esperando_cliente";

  if (orden.estado !== "esperando_cliente") {
    return NextResponse.json({ error: "la orden no está esperando la respuesta del cliente" }, { status: 409 });
  }
  if (body.decision === "aprobada") {
    try {
      transicionar(orden.estado, aEstado, new Set(["cotizacion_aprobada"]));
    } catch (e) {
      if (e instanceof TransicionInvalidaError || e instanceof RequisitoFaltanteError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error: errUpdateCot } = await admin
    .from("cotizacion")
    .update({ decision: body.decision, decidida_en: new Date().toISOString(), decision_ip: ip })
    .eq("id", cotizacion.id);

  if (errUpdateCot) {
    return NextResponse.json({ error: errUpdateCot.message }, { status: 500 });
  }

  if (aEstado !== orden.estado) {
    await admin.from("orden").update({ estado: aEstado, fase_id: null }).eq("id", orden.id);
  }
  await admin.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: orden.id,
    de_estado: orden.estado,
    a_estado: aEstado,
    nota:
      body.decision === "aprobada"
        ? `Cliente aprobó la cotización${reservados.length ? `. Reservado: ${reservados.join(", ")}` : ""}${aEstado === "falta_repuesto" ? ". Falta repuesto" : ""}`
        : `Cliente no aprobó la cotización${motivo ? `. Motivo: ${motivo}` : ""}`,
  });

  await crearAviso(admin, {
    empresaId: orden.empresa_id,
    ordenId: orden.id,
    tipo: body.decision === "aprobada" ? "cotizacion_aprobada" : "cotizacion_rechazada",
    detalle: motivo,
  });

  return NextResponse.json({ ok: true, estado: aEstado });
}
