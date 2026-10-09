/**
 * GET /api/fases -- las fases de la empresa (activas e inactivas), por
 * estado y en orden. La usan /configuracion para administrarlas y el
 * hub de la orden para ofrecer las del estado actual.
 * POST /api/fases -- Body: { estado, nombre }. Crear una fase al final
 * de su estado. Solo admin (configurar_fases).
 *
 * Ver supabase/migrations/0050_fase_orden.sql y lib/fases.ts: una fase
 * es una etiqueta dentro de un estado, nunca un estado nuevo.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { esEstado, siguientePosicion, type FaseOrden } from "@/lib/fases";

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("fase_orden")
    .select("id, estado, nombre, posicion, activo")
    .order("estado")
    .order("posicion");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { estado?: string; nombre?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "configurar_fases")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!esEstado(body.estado)) {
    return NextResponse.json({ error: "estado inválido" }, { status: 400 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre de la fase" }, { status: 400 });
  }

  const { data: existentes } = await supabase
    .from("fase_orden")
    .select("estado, posicion")
    .eq("estado", body.estado);

  const { data, error } = await supabase
    .from("fase_orden")
    .insert({
      empresa_id: perfil.empresaId,
      estado: body.estado,
      nombre: body.nombre.trim(),
      posicion: siguientePosicion((existentes ?? []) as Pick<FaseOrden, "estado" | "posicion">[], body.estado),
    })
    .select("id, estado, nombre, posicion, activo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
