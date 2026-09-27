/**
 * GET /api/sedes/<id>/impresoras -- la configuración de impresoras de
 * una sede (host/puerto/protocolo de tickets y etiquetas), o null si
 * nadie la ha configurado todavía.
 *
 * PATCH /api/sedes/<id>/impresoras -- guardarla (upsert). Mismo
 * permiso que gobierna /sedes -- gestionar_sedes.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

type Protocolo = "crudo" | "puente_android";

interface CuerpoDestino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

interface CuerpoImpresoras {
  tickets: CuerpoDestino;
  etiquetas: CuerpoDestino;
}

function destinoValido(d: Partial<CuerpoDestino> | undefined): d is CuerpoDestino {
  return (
    !!d &&
    !!d.host?.trim() &&
    typeof d.puerto === "number" &&
    d.puerto > 0 &&
    (d.protocolo === "crudo" || d.protocolo === "puente_android")
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data } = await supabase
    .from("impresora_sede")
    .select(
      "tickets_host, tickets_puerto, tickets_protocolo, etiquetas_host, etiquetas_puerto, etiquetas_protocolo",
    )
    .eq("sede_id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    tickets: { host: data.tickets_host, puerto: data.tickets_puerto, protocolo: data.tickets_protocolo },
    etiquetas: { host: data.etiquetas_host, puerto: data.etiquetas_puerto, protocolo: data.etiquetas_protocolo },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<CuerpoImpresoras>;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!destinoValido(body.tickets) || !destinoValido(body.etiquetas)) {
    return NextResponse.json(
      { error: "faltan datos de la impresora de tickets o de etiquetas (host, puerto, protocolo)" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("impresora_sede").upsert(
    {
      sede_id: id,
      empresa_id: perfil.empresaId,
      tickets_host: body.tickets.host.trim(),
      tickets_puerto: body.tickets.puerto,
      tickets_protocolo: body.tickets.protocolo,
      etiquetas_host: body.etiquetas.host.trim(),
      etiquetas_puerto: body.etiquetas.puerto,
      etiquetas_protocolo: body.etiquetas.protocolo,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "sede_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
