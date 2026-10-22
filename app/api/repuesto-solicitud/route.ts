/**
 * POST /api/repuesto-solicitud
 * Body: { descripcion, cantidad, prioridad?, clienteId?, clienteNombre, clienteTelefono }
 *
 * Encargo de mostrador desde Vender: lo que el cliente pide y no hay
 * va a la lista de Compras sin orden, con su nombre y teléfono para
 * saber a quién traérselo (lib/compras/encargo.ts).
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { normalizarEncargo } from "@/lib/compras/encargo";

export async function POST(req: Request) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "vender") && !puede(perfil.rol, "gestionar_compras")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const encargo = normalizarEncargo(await req.json().catch(() => null));
  if (!encargo.ok) {
    return NextResponse.json({ error: encargo.error }, { status: 400 });
  }
  const e = encargo.datos;

  const { data, error } = await supabase
    .from("repuesto_solicitud")
    .insert({
      empresa_id: perfil.empresaId,
      orden_id: null,
      sede_id: perfil.sedeId,
      descripcion: e.descripcion,
      cantidad: e.cantidad,
      prioridad: e.prioridad,
      cliente_id: e.clienteId,
      cliente_nombre: e.clienteNombre,
      cliente_telefono: e.clienteTelefono,
      solicitado_por: perfil.id,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
