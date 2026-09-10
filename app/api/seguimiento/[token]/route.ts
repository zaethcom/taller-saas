/**
 * GET /api/seguimiento/<token>
 *
 * Lo que el cliente ve desde el enlace, sin cuenta y sin login. El token
 * es el único secreto: 32 caracteres hexadecimales aleatorios por orden
 * (orden.token_publico), así que esta ruta usa el cliente con service
 * role a propósito -- no hay sesión de usuario que darle a RLS.
 *
 * Devuelve una lista blanca de campos, nunca la fila completa: así un
 * campo nuevo que alguien agregue a `orden` en el futuro no se filtra
 * aquí por accidente.
 */
import { NextRequest, NextResponse } from "next/server";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = clienteAdmin();

  const { data: orden, error } = await admin
    .from("orden")
    .select(
      `
      id, numero, estado, motivo, abierta_en, cerrada_en,
      producto:producto_id ( serial, tipo, marca, modelo ),
      cliente:producto_id ( cliente:cliente_id ( nombre ) )
    `,
    )
    .eq("token_publico", token)
    .maybeSingle();

  if (error || !orden) {
    // Nunca decir "token inválido" vs. "orden no existe" por separado:
    // ambos casos deben verse iguales desde afuera.
    return NextResponse.json({ error: "enlace no válido o vencido" }, { status: 404 });
  }

  const [{ data: eventos }, { data: cotizacion }, { data: evidencias }] = await Promise.all([
    admin
      .from("orden_evento")
      .select("a_estado, ocurrio_en")
      .eq("orden_id", orden.id)
      .order("ocurrio_en", { ascending: true }),
    admin
      .from("cotizacion")
      .select("id, total, mano_obra, estado, decision, cotizacion_item(descripcion, cantidad, precio_unit)")
      .eq("orden_id", orden.id)
      .order("enviada_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("evidencia")
      .select("ruta, tipo, tomada_en")
      .eq("orden_id", orden.id)
      .eq("visible_cliente", true),
  ]);

  // Se firman aquí, con service role, porque el visitante público no
  // tiene sesión -- la única autorización que tiene es haber llegado
  // con el token correcto, y eso ya se validó arriba.
  const evidenciasFirmadas = await Promise.all(
    (evidencias ?? []).map(async (ev) => {
      const { data: firmada } = await admin.storage
        .from("evidencia")
        .createSignedUrl(ev.ruta, 5 * 60);
      return { tipo: ev.tipo, tomadaEn: ev.tomada_en, url: firmada?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({
    numero: orden.numero,
    estado: orden.estado,
    etiquetaEstado: ETIQUETA_ESTADO[orden.estado as Estado],
    motivo: orden.motivo,
    abiertaEn: orden.abierta_en,
    cerradaEn: orden.cerrada_en,
    producto: orden.producto,
    historial: (eventos ?? []).map((e) => ({
      estado: e.a_estado,
      etiqueta: ETIQUETA_ESTADO[e.a_estado as Estado],
      fecha: e.ocurrio_en,
    })),
    cotizacion,
    evidencias: evidenciasFirmadas,
  });
}
