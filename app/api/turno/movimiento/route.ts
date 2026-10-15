/**
 * POST /api/turno/movimiento
 * Body: { tipo: "ingreso" | "salida", monto: number, motivo: string }
 * Gestión de dinero del turno abierto: registra el movimiento con su
 * motivo (0054_movimiento_caja.sql), deja la apertura en la bitácora
 * apertura_cajon y manda a abrir el cajón por la impresora de tickets.
 * Entra al efectivo esperado del cierre (lib/caja.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { encolarImpresion } from "@/lib/impresion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { tipo?: string; monto?: number; motivo?: string };
  const tipo = body.tipo;
  const monto = Number(body.monto);
  const motivo = body.motivo?.trim() ?? "";

  if (tipo !== "ingreso" && tipo !== "salida") {
    return NextResponse.json({ error: "di si el dinero entra o sale de la caja" }, { status: 400 });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "el monto debe ser mayor a cero" }, { status: 400 });
  }
  if (!motivo) {
    return NextResponse.json({ error: "escribe el motivo del movimiento" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "abrir_cajon_manual")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!perfil.sedeId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const { data: turno } = await supabase
    .from("turno_caja")
    .select("id")
    .eq("sede_id", perfil.sedeId)
    .is("cerrado_en", null)
    .order("abierto_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!turno) {
    return NextResponse.json({ error: "no hay un turno abierto en esta sede" }, { status: 409 });
  }

  const { data: movimiento, error } = await supabase
    .from("movimiento_caja")
    .insert({
      empresa_id: perfil.empresaId,
      sede_id: perfil.sedeId,
      turno_id: turno.id,
      tipo,
      monto,
      motivo,
      autor_id: perfil.id,
    })
    .select("id")
    .single();
  if (error || !movimiento) {
    return NextResponse.json({ error: error?.message ?? "no se pudo registrar el movimiento" }, { status: 500 });
  }

  const motivoCajon = `${tipo === "ingreso" ? "Ingreso" : "Salida"} de dinero: ${motivo}`;
  await supabase.from("apertura_cajon").insert({
    empresa_id: perfil.empresaId,
    sede_id: perfil.sedeId,
    turno_id: turno.id,
    motivo: motivoCajon,
    autor_id: perfil.id,
  });

  await encolarImpresion(supabase, {
    empresaId: perfil.empresaId,
    sedeId: perfil.sedeId,
    tipo: "abrir_cajon",
    creadoPor: perfil.id,
    carga: { motivo: motivoCajon },
  });

  return NextResponse.json({ ok: true, id: movimiento.id });
}
