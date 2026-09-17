/**
 * GET /api/sedes/<id>/marca -- lo que esta sede sobrescribe del recibo
 * (logo, dirección, teléfono, pie), o null si nadie lo ha configurado
 * todavía (usa lo de /configuracion general). Mismo permiso que
 * gobierna /sedes -- gestionar_sedes.
 *
 * PATCH /api/sedes/<id>/marca -- guardarlo (upsert). Un campo vacío
 * ("" o no enviado) se guarda como null, para volver a caer en el
 * valor de la empresa en vez de sobrescribir con un texto vacío.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

interface CuerpoMarcaSede {
  logoUrl?: string | null;
  reciboDireccion?: string | null;
  reciboTelefono?: string | null;
  reciboPie?: string | null;
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
    .from("sede_config")
    .select("logo_url, recibo_direccion, recibo_telefono, recibo_pie")
    .eq("sede_id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    logoUrl: data.logo_url,
    reciboDireccion: data.recibo_direccion,
    reciboTelefono: data.recibo_telefono,
    reciboPie: data.recibo_pie,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as CuerpoMarcaSede;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const vacioANull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  const { error } = await supabase.from("sede_config").upsert(
    {
      sede_id: id,
      empresa_id: perfil.empresaId,
      logo_url: vacioANull(body.logoUrl),
      recibo_direccion: vacioANull(body.reciboDireccion),
      recibo_telefono: vacioANull(body.reciboTelefono),
      recibo_pie: vacioANull(body.reciboPie),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "sede_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
