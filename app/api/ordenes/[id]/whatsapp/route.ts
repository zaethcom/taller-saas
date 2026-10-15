/**
 * GET /api/ordenes/<id>/whatsapp
 * Lo que necesita "Enviar por WhatsApp" de CabeceraOrden: el número
 * (alternativo de la orden o, si no hay, el del cliente) y el mensaje
 * precargado con el enlace de seguimiento según el estado
 * (lib/orden-whatsapp.ts).
 *
 * El técnico lee la orden desde orden_para_tecnico, sin teléfonos
 * (0003_vista_tecnico.sql); esta ruta es la única que los toca para
 * él, y la pantalla no muestra el número, solo a quién va.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";
import { destinoWhatsappOrden, mensajeSeguimiento } from "@/lib/orden-whatsapp";

interface FilaOrden {
  estado: string;
  token_publico: string;
  telefono_alterno: string | null;
  empresa: { nombre: string } | null;
  producto: {
    tipo: string;
    marca: string | null;
    modelo: string | null;
    cliente: { nombre: string; telefono: string | null } | null;
  } | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "enviar_whatsapp_orden")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data } = await supabase
    .from("orden")
    .select(
      "estado, token_publico, telefono_alterno, empresa:empresa_id ( nombre ), producto:producto_id ( tipo, marca, modelo, cliente:cliente_id ( nombre, telefono ) )",
    )
    .eq("id", id)
    .maybeSingle();
  const orden = data as unknown as FilaOrden | null;
  if (!orden) {
    return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  }

  const cliente = orden.producto?.cliente;
  const destino = destinoWhatsappOrden(orden.telefono_alterno, cliente?.telefono);
  if (!destino) {
    return NextResponse.json({ error: "La orden no tiene un número de contacto válido" }, { status: 422 });
  }

  const equipo = [orden.producto?.marca, orden.producto?.modelo].filter(Boolean).join(" ");
  const mensaje = mensajeSeguimiento({
    nombre: cliente?.nombre ?? "",
    estado: orden.estado,
    equipo,
    empresa: orden.empresa?.nombre,
    url: `${req.nextUrl.origin}/seguimiento/${orden.token_publico}`,
  });

  return NextResponse.json({ numero: destino.numero, destino: destino.destino, mensaje });
}
