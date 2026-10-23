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
 *
 * `etiquetas.ajustes` (oscuridad, velocidad, avance, sensor, corrimientos)
 * vive en `etiquetas_ajustes`, migración 0067, con el mismo trato: sin la
 * migración, GET responde {} y PATCH avisa solo si se pidió algún ajuste.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { leerAjustesEtiquetadora } from "@/lib/ajustes-etiquetadora";
import { normalizarAjustes } from "@/estacion/ajustes-etiquetadora";

type Protocolo = "crudo" | "puente_android";
type Lenguaje = "pplb" | "zpl" | "escpos";

interface CuerpoDestino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

interface CuerpoImpresoras {
  tickets: CuerpoDestino & { anchoMm?: 58 | 80 };
  etiquetas: CuerpoDestino & { lenguaje?: Lenguaje; ajustes?: unknown };
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

  // Columna de la migración 0060: sin ella, el papel se toma como de 80 mm.
  const { data: papel } = await supabase
    .from("impresora_sede")
    .select("tickets_ancho_mm")
    .eq("sede_id", id)
    .maybeSingle();

  return NextResponse.json({
    tickets: {
      host: data.tickets_host,
      puerto: data.tickets_puerto,
      protocolo: data.tickets_protocolo,
      anchoMm: papel?.tickets_ancho_mm === 58 ? 58 : 80,
    },
    etiquetas: {
      host: data.etiquetas_host,
      puerto: data.etiquetas_puerto,
      protocolo: data.etiquetas_protocolo,
      lenguaje: idioma?.etiquetas_lenguaje ?? "pplb",
      ajustes: await leerAjustesEtiquetadora(supabase, id),
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
  if (lenguaje !== "pplb" && lenguaje !== "zpl" && lenguaje !== "escpos") {
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

  const anchoMm = body.tickets.anchoMm ?? 80;
  if (anchoMm !== 58 && anchoMm !== 80) {
    return NextResponse.json({ error: "ancho de papel inválido (58 u 80 mm)" }, { status: 400 });
  }
  const { error: errPapel } = await supabase
    .from("impresora_sede")
    .update({ tickets_ancho_mm: anchoMm })
    .eq("sede_id", id);
  if (errPapel && anchoMm === 58) {
    return NextResponse.json(
      {
        error:
          "Se guardaron las impresoras, pero no el papel de 58 mm: falta aplicar la migración 0060_ancho_papel_tickets en la base.",
      },
      { status: 500 },
    );
  }

  const { error: errIdioma } = await supabase
    .from("impresora_sede")
    .update({ etiquetas_lenguaje: lenguaje })
    .eq("sede_id", id);
  if (errIdioma && lenguaje === "escpos") {
    return NextResponse.json(
      {
        error:
          "Se guardaron las impresoras, pero no «Etiquetas en la POS»: falta aplicar la migración 0059_etiquetas_en_pos en la base.",
      },
      { status: 500 },
    );
  }
  if (errIdioma && lenguaje === "zpl") {
    return NextResponse.json(
      {
        error:
          "Se guardaron las impresoras, pero no el idioma Zebra: falta aplicar la migración 0048_lenguaje_etiquetas en la base.",
      },
      { status: 500 },
    );
  }

  const ajustes = normalizarAjustes(body.etiquetas.ajustes);
  const { error: errAjustes } = await supabase
    .from("impresora_sede")
    .update({ etiquetas_ajustes: ajustes })
    .eq("sede_id", id);
  if (errAjustes && Object.keys(ajustes).length > 0) {
    return NextResponse.json(
      {
        error:
          "Se guardaron las impresoras, pero no los ajustes de la etiquetadora: falta aplicar la migración 0067_ajustes_etiquetadora en la base.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
