/**
 * POST /api/repuesto-solicitud/<id>/sin-existencia
 *
 * El almacén no lo tiene. La solicitud pasa a 'faltante' y con eso cae en
 * /compras, que es el flujo que ya existía: comprar y marcar recibido.
 *
 * Lo decide una persona, no la existencia registrada. Si el sistema lo
 * hiciera solo al ver cero, un inventario desactualizado mandaría a
 * comprar algo que está en el estante.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { transicionarSolicitud, type EstadoSolicitud } from "@/lib/solicitudes";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  // La sede ACTIVA, no la principal del perfil: quien decide "no tengo"
  // es el almacén donde la persona está parada ahora.
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const { data: solicitud } = await supabase
    .from("repuesto_solicitud")
    .select("id, estado, sede_proveedora_id")
    .eq("id", id)
    .maybeSingle();

  if (!solicitud) {
    return NextResponse.json({ error: "la solicitud no existe" }, { status: 404 });
  }
  if (solicitud.sede_proveedora_id !== sedeActivaId) {
    return NextResponse.json({ error: "esta solicitud no es para tu sede" }, { status: 403 });
  }

  try {
    transicionarSolicitud(solicitud.estado as EstadoSolicitud, "faltante");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }

  const { error } = await supabase
    .from("repuesto_solicitud")
    .update({ estado: "faltante" })
    .eq("id", id)
    .eq("estado", "pedido_a_sede");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
