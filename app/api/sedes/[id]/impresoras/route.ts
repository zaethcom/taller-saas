/**
 * GET /api/sedes/<id>/impresoras -- la configuración de impresoras de
 * una sede (host/puerto/protocolo de tickets y etiquetas), o null si
 * nadie la ha configurado todavía.
 *
 * PATCH /api/sedes/<id>/impresoras -- guardarla (upsert). Mismo
 * permiso que gobierna /sedes -- gestionar_sedes.
 *
 * `etiquetas.lenguaje` ("pplb" Argox / "zpl" Zebra) vive en una columna
 * de la migración 0048; mientras no esté aplicada, GET responde "pplb"
 * y PATCH guarda lo demás y avisa solo si se pidió Zebra.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

type Protocolo = "crudo" | "puente_android";
type Lenguaje = "pplb" | "zpl";

interface CuerpoDestino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

interface CuerpoImpresoras {
  tickets: CuerpoDestino;
  etiquetas: CuerpoDestino & { lenguaje?: Lenguaje };
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

  const { data: idioma } = await supabase
    .from("impresora_sede")
    .select("etiquetas_lenguaje")
    .eq("sede_id", id)
    .maybeSingle();

  return NextResponse.json({
    tickets: { host: data.tickets_host, puerto: data.tickets_puerto, protocolo: data.tickets_protocolo },
    etiquetas: {
      host: data.etiquetas_host,
      puerto: data.etiquetas_puerto,
      protocolo: data.etiquetas_protocolo,
      lenguaje: idioma?.etiquetas_lenguaje ?? "pplb",
    },
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
  const lenguaje = body.etiquetas.lenguaje ?? "pplb";
  if (lenguaje !== "pplb" && lenguaje !== "zpl") {
    return NextResponse.json({ error: "idioma de etiquetadora inválido" }, { status: 400 });
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

  const { error: errIdioma } = await supabase
    .from("impresora_sede")
    .update({ etiquetas_lenguaje: lenguaje })
    .eq("sede_id", id);
  if (errIdioma && lenguaje === "zpl") {
    return NextResponse.json(
      {
        error:
          "Se guardaron las impresoras, pero no el idioma Zebra: falta aplicar la migración 0048_lenguaje_etiquetas en la base.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
